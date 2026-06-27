import type { Browser, Page } from 'playwright'
import type { CsvRowInput } from '../../importEngine'
import { politeNavigate, USER_AGENT } from '../politeNavigate'
import type { VenueScraper } from '../types'

// Tier 3 (code) — Theatre for a New Audience, Polonsky Shakespeare Center,
// Brooklyn (tfana.org). Classical/Shakespeare rep.
//
// The site was an HTTP 526 SSL/origin error on 2026-06-06; it has since
// recovered. Why code, not template: both the season grid and the event pages
// are JS-hydrated (the "mpspx" event plugin renders client-side), and the show
// synopsis is plain <p> text inside an unclassed ".inner" wrapper (no
// og:description, the JSON-LD Event block has an empty description and a bogus
// startDate time taken from the URL slug). We wait for hydration, then read the
// real run-date range (`span.date`, e.g. "November 10 – December 6, 2026"), the
// og:image poster, and join the lead synopsis paragraphs.

const VENUE_NAME = 'Polonsky Shakespeare Center'
const VENUE_ADDRESS = '262 Ashland Place'
const VENUE_CITY = 'Brooklyn'
const VENUE_STATE = 'NY'
const VENUE_ZIP = '11217'

const SEASON_URL = 'https://tfana.org/current-season/26-27-season'
// The mpspx grid hydrates client-side and its title-link class is unstable;
// every show card links to /events/<slug>, so enumerate by that and let the
// detail page supply the real title.
const LISTING_SELECTOR = 'a[href*="/events/"]'
const DETAIL_READY = 'span.date'

interface ListingCard { title: string; href: string }
interface DetailData { title?: string; date?: string; runStart?: string; runEnd?: string; description?: string; posterUrl?: string }

// "November 10 – December 6, 2026" → start/end ISO. Trailing year applies to
// both ends; handles single dates and cross-month ranges (en or em dash).
const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function parseRange(raw: string): { start?: string; end?: string } {
  const text = (raw || '').replace(/\s+/g, ' ').trim()
  const yearM = text.match(/\b(20\d{2})\b/)
  if (!yearM) return {}
  const year = parseInt(yearM[1], 10)
  const parts = text.split(/\s*[-–—]\s*/).map(s => s.trim()).filter(Boolean)
  const one = (s: string, fb?: number): Date | undefined => {
    const md = s.match(/([A-Za-z]+)\s+(\d{1,2})/)
    if (md) { const mo = MONTHS[md[1].toLowerCase()]; if (mo === undefined) return undefined; return new Date(year, mo, parseInt(md[2], 10)) }
    const d = s.match(/^(\d{1,2})\b/); if (d && fb !== undefined) return new Date(year, fb, parseInt(d[1], 10))
    return undefined
  }
  if (parts.length >= 2) {
    const start = one(parts[0]); const end = one(parts[1], start?.getMonth())
    return { start: start ? ymd(start) : undefined, end: end ? ymd(end) : undefined }
  }
  const s = one(parts[0]); const v = s ? ymd(s) : undefined
  return { start: v, end: v }
}

async function readDetail(page: Page): Promise<DetailData> {
  const title = await page.$eval('h1', e => (e.textContent || '').replace(/\s+/g, ' ').trim()).catch(() => undefined)
    || await page.$eval('meta[property="og:title"]', (m: any) => (m.content || '').replace(/^Theatre for a New Audience\s*[-–—]\s*/i, '').trim()).catch(() => undefined)

  const dateText = await page.$eval('span.date', e => (e.textContent || '').replace(/\s+/g, ' ').trim()).catch(() => '')
  const { start, end } = parseRange(dateText)

  const posterUrl = await page.$eval('meta[property="og:image"]', (m: any) => m.content).catch(() => undefined)

  // Synopsis: the lead readable paragraphs (skip cookie/script/boilerplate).
  const description = await page.$$eval('.inner p, .post-content p', els => {
    const parts: string[] = []
    for (const el of els) {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
      if (t.length > 80 && !/cookie|privacy|browsing experience|var EVENT|function\s*\(|^\{/.test(t)) {
        parts.push(t)
        if (parts.join(' ').length > 400) break
      }
    }
    return parts.join('\n\n') || undefined
  }).catch(() => undefined)

  // og:image occasionally falls back to the site logo on unhydrated pages — drop it.
  const poster = posterUrl && !/tfana-logo/i.test(posterUrl) ? posterUrl : undefined
  return { title, date: start, runStart: start, runEnd: end, description, posterUrl: poster }
}

async function scrapeDetail(browser: Browser, href: string): Promise<DetailData | null> {
  const context = await browser.newContext({ userAgent: USER_AGENT })
  const page = await context.newPage()
  try {
    try {
      await politeNavigate(page, href, { useCache: false, waitForSelector: DETAIL_READY, navTimeoutMs: 45_000 })
    } catch {
      await page.waitForSelector(DETAIL_READY, { timeout: 8_000 }).catch(() => {})
    }
    return await readDetail(page)
  } finally {
    await context.close()
  }
}

async function scrape(page: Page): Promise<Partial<CsvRowInput>[]> {
  const browser = page.context().browser()
  if (!browser) throw new Error('[tfana] no browser handle on page context')

  // Orchestrator already navigated to SEASON_URL (config.waitFor ensures the
  // grid hydrated). Each show is an <a.mpspx-event-griditem-title>.
  const cards: ListingCard[] = await page.$$eval(LISTING_SELECTOR, els =>
    els.map(a => ({
      title: (a.textContent || '').replace(/\s+/g, ' ').trim(),
      href: (a as HTMLAnchorElement).getAttribute('href') || ''
    }))
  )

  // Dedupe by href (each card has image + title + button links to the same show);
  // keep the best (non-empty) title text as a fallback for the detail title.
  const byHref = new Map<string, ListingCard>()
  for (const c of cards) {
    if (!c.href || !/\/events\/[a-z0-9]/i.test(c.href)) continue
    const prev = byHref.get(c.href)
    if (!prev || (!prev.title && c.title)) byHref.set(c.href, c)
  }
  const unique = [...byHref.values()]

  const rows: Partial<CsvRowInput>[] = []
  let skipped = 0

  for (const card of unique) {
    const abs = new URL(card.href, 'https://tfana.org').toString()
    const detail = await scrapeDetail(browser, abs)
    if (!detail || !detail.runStart || !detail.description || !detail.posterUrl) {
      console.warn(`[tfana] skip "${card.title}" — missing ${!detail ? 'detail' : [!detail.runStart && 'date', !detail.description && 'desc', !detail.posterUrl && 'poster'].filter(Boolean).join('+')}`)
      skipped++
      continue
    }
    const title = detail.title || card.title
    if (!title) { console.warn(`[tfana] skip ${abs} — no title`); skipped++; continue }
    rows.push({
      title,
      venueName: VENUE_NAME,
      venueAddress: VENUE_ADDRESS,
      venueCity: VENUE_CITY,
      venueState: VENUE_STATE,
      venueZipCode: VENUE_ZIP,
      performanceTypes: 'theater',
      showUrl: abs,
      ticketUrl: abs, // no per-show ticket link exposed pre-on-sale; detail page is the info/ticket entry
      showImageUrl: detail.posterUrl,
      showPosterUrl: detail.posterUrl,
      showDescription: detail.description,
      date: detail.date,
      runStartDate: detail.runStart,
      runEndDate: detail.runEnd
    })
    console.log(`[tfana] ${card.title} — ${detail.runStart}${detail.runEnd && detail.runEnd !== detail.runStart ? `→${detail.runEnd}` : ''}`)
  }

  console.log(`[tfana] ${unique.length} cards → ${rows.length} rows (${skipped} skipped)`)
  return rows
}

export const tfanaScraper: VenueScraper = {
  id: 'tfana',
  name: 'Theatre for a New Audience (tfana.org)',
  startUrl: SEASON_URL,
  scrape
}
