import type { Browser, Page } from 'playwright'
import type { CsvRowInput } from '../../importEngine'
import { politeNavigate, USER_AGENT } from '../politeNavigate'
import type { VenueScraper } from '../types'

// Tier 3 (code) — Theaterlab, Garment District (NYC).
//
// Why code, not a template: theaterlabnyc.com/news/ ("NOW AND NEXT") lists each
// showing as article.post, but two facts defeat the V2 template engine:
//   1. TITLE. The detail page's first <h2> is a section header ("PERFORMANCES")
//      on TLAB SHARES pages and the real title ("THIS MOTHERLESS EARTH") on
//      Hotel New Work pages — so `h2` first-match staged "PERFORMANCES" as the
//      title. The reliable title is the QUOTED middle segment of the listing's
//      ".post-title" ("TLAB SHARES | 'Mugs Without People' | July 9-12, 2026").
//   2. SYNOPSIS. It sits at a different paragraph index per page and is bracketed
//      by program boilerplate, a schedule, a price list, and long cast bios. The
//      rule that holds across page types is "first .tb_text_wrap paragraph >=150
//      chars that isn't program boilerplate, a schedule line, or a price list" —
//      which the template engine (first/Nth match only, no length/content filter)
//      can't express.

const VENUE_NAME = 'Theaterlab'
const VENUE_ADDRESS = '357 West 36th Street'
const VENUE_CITY = 'New York'
const VENUE_STATE = 'NY'
const VENUE_ZIP = '10018'

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// First "Month Day" in the mashed listing title; year inferred (roll forward if
// >30 days past, matching the template engine's date handling).
function parseListingDate(text: string, now: Date): string | undefined {
  const m = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})\b/)
  if (!m) return undefined
  const mo = MONTHS[m[1].slice(0, 3).toLowerCase()]
  if (mo === undefined) return undefined
  const day = parseInt(m[2], 10)
  let d = new Date(now.getFullYear(), mo, day)
  const daysAgo = (now.getTime() - d.getTime()) / 86_400_000
  if (daysAgo > 30) d = new Date(now.getFullYear() + 1, mo, day)
  return ymd(d)
}

// The show title is the segment between the first and second "|" of the listing
// title, with surrounding quotes stripped: "Program | 'Title' | Date" → Title.
function extractTitle(postTitle: string): string | undefined {
  const parts = postTitle.split('|').map(s => s.trim()).filter(Boolean)
  const mid = parts.length >= 3 ? parts[1] : parts.length === 2 ? parts[0] : postTitle.trim()
  return mid.replace(/^['"‘’“”]+|['"‘’“”]+$/g, '').trim() || undefined
}

// First substantial synopsis paragraph: >=150 chars, not program boilerplate, a
// schedule, or a price list. Scanning top-down returns the synopsis before the
// (longer) cast bios further down the page.
async function readDescription(page: Page): Promise<string | undefined> {
  return page.$$eval('.tb_text_wrap p', els => {
    const clean = (t: string) => t.replace(/\s+/g, ' ').trim()
    const BOILER = /^(Theaterlab provides|HOTEL NEW WORK provides|TLAB SHARES is a curated|An artistic respite|We invite you|They['’]ll share|Theaterlab is (happy|excited)|Those interested|If you are able)/i
    const SCHED = /@\s*\d|\d\s*[AP]M\b|:\d\d\s*[AP]M/i
    const PRICERE = /\$\d|with fees/i
    for (const el of els) {
      const t = clean(el.textContent || '')
      if (t.length >= 150 && !BOILER.test(t) && !SCHED.test(t) && !PRICERE.test(t)) return t
    }
    return undefined
  }).catch(() => undefined)
}

interface Listing {
  title: string
  href: string
  poster?: string
  date?: string
}

async function scrapeDetail(browser: Browser, href: string): Promise<{ description?: string; ticketUrl?: string }> {
  const context = await browser.newContext({ userAgent: USER_AGENT })
  const page = await context.newPage()
  try {
    await politeNavigate(page, href, { useCache: false, navTimeoutMs: 45_000 }).catch(() => {})
    const description = await readDescription(page)
    const ticketUrl = await page.$eval('a[href*="ovationtix"]', (a: any) => a.href).catch(() => undefined)
    return { description, ticketUrl }
  } finally {
    await context.close()
  }
}

async function scrape(page: Page): Promise<Partial<CsvRowInput>[]> {
  const browser = page.context().browser()
  if (!browser) throw new Error('[theaterlab] no browser handle on page context')
  const now = new Date()

  const listings: Listing[] = await page.$$eval('article.post', els =>
    els.map(e => {
      const pt = (e.querySelector('.post-title')?.textContent || '').replace(/\s+/g, ' ').trim()
      const a = e.querySelector('.post-title a') as HTMLAnchorElement | null
      const img = e.querySelector('img') as HTMLImageElement | null
      return {
        postTitle: pt,
        href: a?.getAttribute('href') || '',
        poster: img?.getAttribute('src') || img?.getAttribute('data-src') || undefined
      }
    })
  ).then(rows => rows
    .filter(r => r.href && r.postTitle)
    .map(r => ({
      title: extractTitle(r.postTitle) || '',
      href: r.href,
      poster: r.poster,
      date: parseListingDate(r.postTitle, now)
    }))
    .filter(r => r.title)
  )

  const seen = new Set<string>()
  const unique = listings.filter(l => !seen.has(l.href) && seen.add(l.href))

  const rows: Partial<CsvRowInput>[] = []
  let skipped = 0
  for (const l of unique) {
    const abs = new URL(l.href, 'https://theaterlabnyc.com').toString()
    const detail = await scrapeDetail(browser, abs)
    if (!detail.description) {
      console.warn(`[theaterlab] skip "${l.title}" — no synopsis found`)
      skipped++
      continue
    }
    rows.push({
      title: l.title,
      venueName: VENUE_NAME,
      venueAddress: VENUE_ADDRESS,
      venueCity: VENUE_CITY,
      venueState: VENUE_STATE,
      venueZipCode: VENUE_ZIP,
      performanceTypes: 'theater',
      date: l.date,
      showUrl: abs,
      ticketUrl: detail.ticketUrl || abs,
      showImageUrl: l.poster,
      performanceImageUrl: l.poster,
      showPosterUrl: l.poster,
      showDescription: detail.description
    })
    console.log(`[theaterlab] ${l.title} — ${l.date || 'no date'}`)
  }
  console.log(`[theaterlab] ${unique.length} listings → ${rows.length} rows (${skipped} skipped)`)
  return rows
}

export const theaterlabScraper: VenueScraper = {
  id: 'theaterlab',
  name: 'Theaterlab (theaterlabnyc.com)',
  startUrl: 'https://theaterlabnyc.com/news/',
  scrape
}
