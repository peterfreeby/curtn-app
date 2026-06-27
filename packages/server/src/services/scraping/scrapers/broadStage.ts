import type { Browser, Page } from 'playwright'
import type { CsvRowInput } from '../../importEngine'
import { politeNavigate, USER_AGENT } from '../politeNavigate'
import type { VenueScraper } from '../types'

// Tier 3 (code) — The Broad Stage, Santa Monica (broadstage.org).
//
// Why code, not a template: the /2627-season page lists 34 cards (title + date +
// detail URL + poster) that a template handles fine — but the show DESCRIPTION
// can't be templated. Each /tickets-shows/calendar/<slug>/ page ships NO
// og:description, and the synopsis is an UNCLASSED <p> whose position varies per
// show (the Usn/Tessitura CMS lays each event page out by hand — the first
// paragraph is sometimes a byline, sometimes a date). The reliable rule across
// the season is "the first <section.content> paragraph longer than ~140 chars",
// which the V2 template engine can't express (it only selects first/Nth match,
// no length filter). So we read it in code.
//
// Dates also need code: the card date is a human range like "September 22-November
// 1, 2026" or "October 22-24, 2026" using an un-spaced ASCII hyphen, which the
// shared parseDateRange mis-reads (it only splits en/em-dashes and spaced
// hyphens). We parse the range here so the run dates are correct.
//
// The Broad Stage and its smaller "blackbox" (The Edye) share one building, so a
// single venue/address covers the season; co-productions are still presented here.

const VENUE_NAME = 'The Broad Stage'
const VENUE_ADDRESS = '1310 11th St'
const VENUE_CITY = 'Santa Monica'
const VENUE_STATE = 'CA'
const VENUE_ZIP = '90401'

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
}

interface ListingCard {
  title: string
  href: string
  dateText: string
  series: string
  cardImage?: string
}

interface DetailData {
  description?: string
  posterUrl?: string
  ticketUrl?: string
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Parse a Broad Stage card date string into {start, end} ISO ymd. Handles:
//   "September 17, 2026"            → single (start === end)
//   "October 22-24, 2026"          → same-month range
//   "September 22-November 1, 2026" → cross-month range (trailing year both ends)
function parseCardDate(raw: string): { start?: string; end?: string } {
  const text = (raw || '').replace(/\s+/g, ' ').trim()
  const yearM = text.match(/\b(20\d{2})\b/)
  if (!yearM) return {}
  const year = parseInt(yearM[1], 10)

  const parts = text.split(/\s*[-–—]\s*/).map(s => s.trim()).filter(Boolean)

  const parseOne = (s: string, fallbackMonth?: number): Date | undefined => {
    // "September 22", "November 1, 2026", or a bare day "24"
    const mdM = s.match(/([A-Za-z]+)\s+(\d{1,2})/)
    if (mdM) {
      const mo = MONTHS[mdM[1].toLowerCase()]
      if (mo === undefined) return undefined
      return new Date(year, mo, parseInt(mdM[2], 10))
    }
    const dayM = s.match(/^(\d{1,2})\b/)
    if (dayM && fallbackMonth !== undefined) {
      return new Date(year, fallbackMonth, parseInt(dayM[1], 10))
    }
    return undefined
  }

  if (parts.length >= 2) {
    const start = parseOne(parts[0])
    // end may carry its own month ("November 1, 2026") or be a bare day ("24")
    const end = parseOne(parts[1], start?.getMonth())
    return { start: start ? ymd(start) : undefined, end: end ? ymd(end) : undefined }
  }
  const single = parseOne(parts[0])
  const s = single ? ymd(single) : undefined
  return { start: s, end: s }
}

function inferType(series: string, title: string): string {
  const blob = `${series} ${title}`.toLowerCase()
  if (/nat geo live|galapagos|barrier reef|discovering/.test(blob)) return 'talk'
  if (/opera|davidsen|rendall/.test(blob)) return 'opera'
  if (/quartet|chamber|orchestra|trio|denk|kanneh|orpheus|symphony|recital|philharmon/.test(blob)) return 'classical'
  if (/dance|ballet/.test(blob)) return 'dance'
  if (/co-production|theatre|theater|\bplay\b|kaiju/.test(blob)) return 'theater'
  return 'music'
}

async function readDetail(page: Page): Promise<DetailData> {
  // Synopsis: first <section.content> paragraph over 140 chars (skips bylines,
  // dates, and the "Tickets for this performance…" boilerplate paragraph).
  const description = await page.$$eval('section.content p', els => {
    for (const el of els) {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
      if (t.length > 140 && !/^Tickets for this performance/i.test(t)) return t
    }
    return undefined
  }).catch(() => undefined)

  const posterUrl = await page.$eval('meta[property="og:image"]', (m: any) => m.content)
    .catch(() => undefined)

  // First real ticket/purchase link (Tessitura cart, "Buy", etc.).
  const ticketUrl = await page.$$eval('a', els => {
    const a = els.find(e => {
      const href = (e as HTMLAnchorElement).getAttribute('href') || ''
      const txt = (e.textContent || '').toLowerCase()
      return /tickets|buy|cart|purchase|tessitura|secure|my\.broadstage/i.test(href + ' ' + txt) &&
        /^https?:\/\//.test(href)
    }) as HTMLAnchorElement | undefined
    return a?.href
  }).catch(() => undefined)

  return { description, posterUrl, ticketUrl }
}

async function scrapeDetail(browser: Browser, href: string): Promise<DetailData | null> {
  const context = await browser.newContext({ userAgent: USER_AGENT })
  const page = await context.newPage()
  try {
    try {
      await politeNavigate(page, href, { useCache: false, waitForSelector: 'section.content', navTimeoutMs: 45_000 })
    } catch {
      // A waitForSelector/nav timeout doesn't mean the page is unusable — the
      // content section can still be present. Give it one more brief chance,
      // then read whatever loaded. readDetail returns no description if it
      // genuinely failed, and the caller drops the row.
      await page.waitForSelector('section.content p', { timeout: 8_000 }).catch(() => {})
    }
    return await readDetail(page)
  } finally {
    await context.close()
  }
}

async function scrape(page: Page): Promise<Partial<CsvRowInput>[]> {
  const browser = page.context().browser()
  if (!browser) throw new Error('[broadStage] no browser handle on page context')

  // The orchestrator already navigated `page` to startUrl. Grab the season cards.
  const cards: ListingCard[] = await page.$$eval('.item', els =>
    els
      .filter(e => e.querySelector('a[href*="/tickets-shows/calendar/"]') && e.querySelector('h1,h2,h3,h4'))
      .map(e => {
        const a = e.querySelector('a[href*="/tickets-shows/calendar/"]') as HTMLAnchorElement | null
        const full = (e.textContent || '').replace(/\s+/g, ' ').trim()
        const title = (e.querySelector('h1,h2,h3,h4')?.textContent || '').trim()
        // Leading date, then the series sits between the date and the title.
        const dateM = full.match(/^[A-Za-z]+ \d{1,2}(?:\s*[-–—]\s*(?:[A-Za-z]+ )?\d{1,2})?,?\s*20\d{2}/)
        const dateText = dateM ? dateM[0] : ''
        let series = dateText ? full.slice(dateText.length).trim() : full
        const ti = series.indexOf(title)
        series = ti > 0 ? series.slice(0, ti).trim() : ''
        const img = e.querySelector('img') as HTMLImageElement | null
        const cardImage = img?.getAttribute('src') || img?.getAttribute('data-src') || undefined
        return { title, href: a?.getAttribute('href') || '', dateText, series, cardImage }
      })
  )

  // Dedupe by href (defensive — the season page lists each show once).
  const seen = new Set<string>()
  const unique = cards.filter(c => c.title && c.href && !seen.has(c.href) && seen.add(c.href))

  const rows: Partial<CsvRowInput>[] = []
  let skipped = 0

  for (const card of unique) {
    const absHref = new URL(card.href, 'https://broadstage.org').toString()
    const { start, end } = parseCardDate(card.dateText)
    if (!start) {
      console.warn(`[broadStage] skip "${card.title}" — unparseable date "${card.dateText}"`)
      skipped++
      continue
    }

    const detail = await scrapeDetail(browser, absHref)
    if (!detail || !detail.description) {
      // Description is required by the quality bar; don't stage a thin row.
      console.warn(`[broadStage] skip "${card.title}" — no description (${detail ? 'detail ok' : 'detail failed'})`)
      skipped++
      continue
    }

    rows.push({
      title: card.title,
      venueName: VENUE_NAME,
      venueAddress: VENUE_ADDRESS,
      venueCity: VENUE_CITY,
      venueState: VENUE_STATE,
      venueZipCode: VENUE_ZIP,
      performanceTypes: inferType(card.series, card.title),
      showUrl: absHref,
      ticketUrl: detail.ticketUrl || absHref,
      showImageUrl: detail.posterUrl || card.cardImage,
      showPosterUrl: detail.posterUrl || card.cardImage,
      showDescription: detail.description,
      date: start,
      runStartDate: start,
      runEndDate: end
    })
    console.log(`[broadStage] ${card.title} — ${start}${end && end !== start ? `→${end}` : ''} (${card.series || 'main'})`)
  }

  console.log(`[broadStage] ${unique.length} cards → ${rows.length} rows (${skipped} skipped)`)
  return rows
}

export const broadStageScraper: VenueScraper = {
  id: 'broad-stage',
  name: 'The Broad Stage (broadstage.org)',
  startUrl: 'https://broadstage.org/2627-season/',
  scrape
}
