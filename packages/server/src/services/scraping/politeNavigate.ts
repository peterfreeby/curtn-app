import type { Page } from 'playwright'
import { readCache, writeCache } from './cache'
import { awaitPoliteWindow, checkRobots, getCrawlDelayMs, USER_AGENT } from './politeness'

// Single chokepoint for "load this URL into a Playwright Page". Handles:
//   - robots.txt check (skip if disallowed)
//   - per-host rate limiting (5s + jitter, plus any Crawl-Delay from robots)
//   - disk cache (read on hit, write on miss) — saves repeat hits during
//     template authoring or successive probe runs
//
// Cache hits are loaded via page.setContent() so the rest of the extractor
// pipeline (page.$$, page.evaluate, etc.) sees a real DOM. We inject a
// <base href> tag so relative URLs in the cached HTML still resolve.

export interface PoliteNavigateOptions {
  useCache?: boolean        // default: true (probes); orchestrator passes false
  cacheMaxAgeMs?: number
  waitForSelector?: string
  waitForPopulated?: string // wait until selector exists AND has non-empty text/data-full
  hydrationDelayMs?: number // default: 2000 — JS hydration grace period
  navTimeoutMs?: number     // default: 30000
  forceRobots?: boolean     // bypass robots.txt check (default: false)
}

export interface PoliteNavigateResult {
  fromCache: boolean
  cachedAt?: Date
  status: number | null
}

export async function politeNavigate(
  page: Page,
  url: string,
  opts: PoliteNavigateOptions = {}
): Promise<PoliteNavigateResult> {
  const {
    useCache = true,
    cacheMaxAgeMs,
    waitForSelector,
    waitForPopulated,
    hydrationDelayMs = 2_000,
    navTimeoutMs = 30_000,
    forceRobots = false
  } = opts

  if (useCache) {
    const cached = await readCache(url, { maxAgeMs: cacheMaxAgeMs })
    if (cached) {
      const html = injectBase(cached.html, url)
      await page.setContent(html, { waitUntil: 'load', timeout: navTimeoutMs })
      return {
        fromCache: true,
        cachedAt: new Date(cached.fetchedAt),
        status: 200
      }
    }
  }

  if (!forceRobots) {
    const verdict = await checkRobots(url)
    if (!verdict.allowed) {
      throw new RobotsBlockedError(url, verdict.reason)
    }
  }

  // Honor any Crawl-Delay from robots.txt by adding it to the politeness gate
  const host = new URL(url).host
  const crawlDelayMs = getCrawlDelayMs(host)
  await awaitPoliteWindow(url, crawlDelayMs ? { minDelayMs: crawlDelayMs } : undefined)

  const response = await page.goto(url, {
    waitUntil: 'load',
    timeout: navTimeoutMs
  })

  if (waitForPopulated) {
    // Wait for JS hydration to actually FILL the element, not just insert the
    // empty shell. Swallow timeout: fall back to whatever's present so a slow /
    // genuinely-empty page still yields its listing-merged row.
    await page
      .waitForFunction(
        (sel) => {
          const el = document.querySelector(sel)
          if (!el) return false
          const v = el.getAttribute('data-full') ?? el.textContent ?? ''
          return v.trim().length > 0
        },
        waitForPopulated,
        { timeout: navTimeoutMs, polling: 250 }
      )
      .catch(() => {})
  } else if (waitForSelector) {
    await page.waitForSelector(waitForSelector, { timeout: navTimeoutMs })
  } else if (hydrationDelayMs > 0) {
    await page.waitForTimeout(hydrationDelayMs)
  }

  if (useCache) {
    const html = await page.content()
    await writeCache(url, html)
  }

  return {
    fromCache: false,
    status: response?.status() ?? null
  }
}

export class RobotsBlockedError extends Error {
  constructor(public url: string, public reason: string) {
    super(`Robots blocked: ${url} — ${reason}`)
    this.name = 'RobotsBlockedError'
  }
}

function injectBase(html: string, url: string): string {
  if (/<base\s+href=/i.test(html)) return html
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1><base href="${escapeAttr(url)}">`)
  }
  return `<base href="${escapeAttr(url)}">${html}`
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

// Re-export for ergonomics
export { USER_AGENT }
