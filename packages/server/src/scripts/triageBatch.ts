import '../config/env'
import { chromium } from 'playwright'
import { findJsonLdEvents } from '../services/scraping/extractors/jsonLd'
import { politeNavigate, USER_AGENT } from '../services/scraping/politeNavigate'

// Fast read-only richness triage. For each base domain, try a few common
// listing paths and report the strongest signal found:
//   - real Event JSON-LD count
//   - .eventlist-event--upcoming (Squarespace) count
//   - event-card / show-list-item / event-item class counts
// Goal: find the next clean hand-author target without cold-rolling onto duds.

const BASES = process.argv.slice(2)
const PATHS = ['', '/events', '/calendar', '/shows', '/whats-on', '/season', '/upcoming', '/performances', '/now-playing']

async function probe(browser: import('playwright').Browser, url: string) {
  const ctx = await browser.newContext({ userAgent: USER_AGENT })
  const page = await ctx.newPage()
  try {
    const resp = await politeNavigate(page, url, { navTimeoutMs: 25000 })
    const status = resp?.status ?? 0
    if (typeof status === 'number' && status >= 400) { await ctx.close(); return { url, status, note: 'http-' + status } }
    let jsonLd = 0
    try { jsonLd = (await findJsonLdEvents(page)).count } catch { /* ignore */ }
    const sq = await page.locator('.eventlist-event--upcoming').count().catch(() => 0)
    const ec = await page.locator('[class*="event-card"]').count().catch(() => 0)
    const sli = await page.locator('[class*="show-list-item"], [class*="event-list-item"], [class*="event-item"]').count().catch(() => 0)
    await ctx.close()
    return { url, status, jsonLd, sq, ec, sli }
  } catch (e) {
    await ctx.close().catch(() => {})
    return { url, status: 'ERR', note: (e as Error).message.slice(0, 60) }
  }
}

async function main() {
  const browser = await chromium.launch()
  try {
    for (const base of BASES) {
      let best: any = null
      for (const p of PATHS) {
        const url = base.replace(/\/$/, '') + p
        const r = await probe(browser, url)
        const score = (r.jsonLd ?? 0) * 3 + (r.sq ?? 0) * 2 + (r.ec ?? 0) + (r.sli ?? 0)
        if (!best || score > best.score) best = { ...r, score, path: p || '/' }
        if ((r.jsonLd ?? 0) >= 3 || (r.sq ?? 0) >= 3) break // strong enough, stop
      }
      const flags = best.note
        ? best.note
        : `jsonLd=${best.jsonLd ?? 0} sq=${best.sq ?? 0} ec=${best.ec ?? 0} sli=${best.sli ?? 0}`
      console.log(`${best.score >= 6 ? '✓' : ' '} ${base}  [${best.path}]  ${flags}`)
    }
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
