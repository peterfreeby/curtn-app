import { chromium } from 'playwright'
import { USER_AGENT } from '../scraping/politeNavigate'

export interface DiscoveryConfig {
  /** A reachable light page (homepage / season nav) that links to detail pages. */
  url: string
  /** Substring matched against each anchor href to keep only detail links. */
  linkPattern: string
  /** Optional cap on discovered URLs. */
  maxUrls?: number
}

const CHALLENGE_RE = /just a moment|please wait|attention required/i

/**
 * Harvest detail-page URLs from a venue's reachable light page.
 *
 * Cloudflare-walled venues still tend to leave a light page (homepage, season
 * nav) that clears the JS challenge in a real browser — that's where the detail
 * URLs live. We can't reach the *content* pages, but we can reach the index of
 * them, then hand those URLs to the FB Graph API (rung 4) for the OG stubs.
 *
 * Runs Playwright, so this is a LOCAL-only step (like the scraper) — it can't
 * run in the deployed serverless mutation.
 */
export async function discoverShowUrls(config: DiscoveryConfig): Promise<string[]> {
  const browser = await chromium.launch({ headless: true })
  try {
    const ctx = await browser.newContext({ userAgent: USER_AGENT })
    const page = await ctx.newPage()
    await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => {})

    // Wait out the Cloudflare interstitial: poll until the title is real and the
    // page has anchors matching our pattern, tolerating mid-challenge reloads.
    for (let i = 0; i < 20; i++) {
      try {
        const title = await page.title()
        if (!CHALLENGE_RE.test(title) && title.trim()) {
          const hasLinks = await page.$(`a[href*="${config.linkPattern}"]`)
          if (hasLinks) break
        }
      } catch {
        /* navigating — retry */
      }
      await page.waitForTimeout(1500)
    }
    try {
      await page.waitForLoadState('networkidle', { timeout: 10_000 })
    } catch {
      /* best-effort */
    }

    const urls = await page.evaluate((pattern: string) => {
      const out = new Set<string>()
      document.querySelectorAll('a[href]').forEach(a => {
        const href = (a as HTMLAnchorElement).href
        if (href.includes(pattern)) out.add(href.split('#')[0])
      })
      return Array.from(out)
    }, config.linkPattern)

    return config.maxUrls ? urls.slice(0, config.maxUrls) : urls
  } finally {
    await browser.close()
  }
}
