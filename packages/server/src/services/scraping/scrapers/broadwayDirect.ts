import type { Browser, Page } from 'playwright'
import type { CsvRowInput } from '../../importEngine'
import { politeNavigate, USER_AGENT } from '../politeNavigate'
import type { VenueScraper } from '../types'

// Tier 3 (code) — BroadwayDirect, the unifying Broadway source.
//
// Why code, not a template: broadwaydirect.com/shows is a near-complete Broadway
// listing (~45 shows) that spans ALL three ticketing platforms' houses — Shubert
// (Schoenfeld, Jacobs, Golden, Belasco, Lyceum, Longacre, Broadway Theatre),
// ATG/ex-Jujamcyn (O'Neill, Walter Kerr, St. James), Nederlander (Minskoff,
// Gershwin), and Disney (New Amsterdam). Telecharge (403) and Ticketmaster (401)
// are both bot-walled and atgtickets.com has no NYC site, so this one scraper
// covers most of the ~36 Broadway houses and sidesteps the blocks entirely.
// Venue attribution is reliable: each /show/<slug>/ detail page carries a
// ".glance-item — Theatre Venue <Name>, New York" line, which we map to venueName
// PER ROW so each show lands on its correct Venue record.
//
// Broadway is open-run: BD gives a WEEKLY schedule pattern (Tue 7, Wed 1&7, dark
// Mon…) plus an "On Sale Through <date>" run-end, not discrete dated rows. Per
// Peter's call we fan the weekly pattern out into one dated Performance row per
// show-time, bounded to a rolling HORIZON_WEEKS window so we don't stage months
// of speculative future shows — the recurring re-scrape rolls the window forward.
//
// Detail pages sit behind a Cloudflare managed challenge that clears exactly ONCE
// per fresh browser context (headless Chromium passes the first request, then gets
// the "Just a moment…" wall on every subsequent nav in that context — masking
// navigator.webdriver doesn't help). So each show gets its OWN context: navigate,
// extract, close. Waiting for ".glance-item" gives the one-shot JS challenge time
// to resolve before we read the DOM.

const HORIZON_WEEKS = 8
const HORIZON_DAYS = HORIZON_WEEKS * 7
const DETAIL_SELECTOR = '.glance-item'
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface ListingCard {
  title: string
  href: string
  meta: string
}

interface DetailData {
  venueName?: string
  posterUrl?: string
  description?: string
  performanceType?: string
  duration?: string
  // weekday index (0=Sun..6=Sat) → list of normalized times ("7:00 PM").
  // Present on "table" show pages; fanned across the horizon by the caller.
  schedule: Map<number, string[]>
  // Real dated performances from the live ticket calendar ("calendar" show
  // pages). When non-empty, the caller uses these verbatim instead of fanning.
  calendarPerfs: { date: string; time: string; ticketUrl: string }[]
}

// "August 9" / "January 17 2027" / "November 10" → Date at local midnight.
// When the phrase omits a year, pick the first occurrence on/after `from`
// (Broadway listings never reference a past run-end).
function parseDatePhrase(phrase: string, from: Date): Date | undefined {
  const m = phrase.trim().match(/([A-Za-z]+)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?/)
  if (!m) return undefined
  const monthIdx = [
    'january', 'february', 'march', 'april', 'may', 'june', 'july',
    'august', 'september', 'october', 'november', 'december'
  ].indexOf(m[1].toLowerCase())
  if (monthIdx < 0) return undefined
  const day = parseInt(m[2], 10)
  if (m[3]) return new Date(parseInt(m[3], 10), monthIdx, day)
  // No year: choose the year that puts this date on/after `from`.
  let year = from.getFullYear()
  let d = new Date(year, monthIdx, day)
  if (d < startOfDay(from)) d = new Date(++year, monthIdx, day)
  return d
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function ymd(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// "07:00pm" / "7pm" / "2:30 PM" → "7:00 PM". Returns undefined if not a time.
function normalizeTime(raw: string): string | undefined {
  let m = raw.match(/(\d{1,2}):(\d{2})\s*([ap]m)/i)
  if (m) {
    const h = parseInt(m[1], 10)
    return `${h}:${m[2]} ${m[3].toUpperCase()}`
  }
  m = raw.match(/(\d{1,2})\s*([ap]m)/i)
  if (m) {
    const h = parseInt(m[1], 10)
    return `${h}:00 ${m[2].toUpperCase()}`
  }
  return undefined
}

// Parse a schedule cell ("01:00pm 07:00pm 1pm & 7pm" / "NO SHOW") into a
// deduped list of normalized times. Prefer the explicit h:mm forms (the human
// "1pm & 7pm" suffix would otherwise double-count).
function parseTimes(cell: string): string[] {
  if (/no show/i.test(cell)) return []
  const out: string[] = []
  const seen = new Set<string>()
  const colon = cell.match(/\d{1,2}:\d{2}\s*[ap]m/gi)
  const tokens = colon && colon.length ? colon : (cell.match(/\d{1,2}\s*[ap]m/gi) ?? [])
  for (const t of tokens) {
    const n = normalizeTime(t)
    if (n && !seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  return out
}

// Title bar reads "Aladdin Broadway Tickets | Musical | NYC Show | Broadway
// Direct" — the second segment is the genre. Map to a Curtn performanceType.
function genreFromTitle(pageTitle: string): string | undefined {
  const seg = pageTitle.split('|').map(s => s.trim())
  const blob = seg.slice(1).join(' ').toLowerCase()
  if (/musical/.test(blob)) return 'musical'
  if (/comedy/.test(blob)) return 'comedy'
  if (/\bplay\b|drama/.test(blob)) return 'play'
  return undefined
}

async function scrapeDetail(browser: Browser, card: ListingCard): Promise<DetailData | null> {
  // Fresh context per show — see the Cloudflare note in the file header.
  const context = await browser.newContext({ userAgent: USER_AGENT })
  const page = await context.newPage()
  try {
    try {
      await politeNavigate(page, card.href, {
        useCache: false,
        waitForSelector: DETAIL_SELECTOR,
        navTimeoutMs: 45_000
      })
    } catch {
      return null // Cloudflare didn't clear or page rotted — skip this show
    }

    // .glance-item is server-rendered, but the schedule (weekly table OR the live
    // ticket calendar) hydrates via JS slightly later. Wait for either to appear
    // before reading so we don't miss an unhydrated calendar (the MJ/Chess bug).
    // Tolerate shows that have neither (future openings) via the catch.
    await page.waitForSelector('a.perf, .show-schedule-table-item', { timeout: 8_000 }).catch(() => {})

    return await readDetail(page)
  } finally {
    await context.close()
  }
}

async function readDetail(page: Page): Promise<DetailData> {
  const pageTitle = await page.title()

  const venueRaw = await page.$$eval('.glance-item', els => {
    const v = els.find(e => /Theatre Venue/i.test(e.textContent || ''))
    return v?.textContent?.replace(/\s+/g, ' ').trim()
  }).catch(() => undefined)
  // "Theatre Venue New Amsterdam Theatre, New York" → "New Amsterdam Theatre"
  const venueName = venueRaw
    ?.replace(/^Theatre Venue\s*/i, '')
    .replace(/,\s*New York\s*$/i, '')
    .trim() || undefined

  const durationRaw = await page.$$eval('.glance-item', els => {
    const v = els.find(e => /Run Time/i.test(e.textContent || ''))
    return v?.textContent?.replace(/\s+/g, ' ').trim()
  }).catch(() => undefined)
  const duration = durationRaw?.replace(/^Run Time\s*/i, '').trim() || undefined

  const posterUrl = await page.$eval('meta[property="og:image"]', (m: any) => m.content)
    .catch(() => undefined)

  let description = await page.$eval('.show-content-container-section',
    e => e.textContent?.replace(/\s+/g, ' ').trim()
  ).catch(() => undefined)
  if (description) {
    description = description
      .replace(/^.*?Tickets\s*&\s*Information\s*/i, '')   // leading "<Title> Tickets & Information"
      .replace(/\s*Read\s+(more|less)\s*$/i, '')          // trailing WP expander label
      .trim() || undefined
  }

  const scheduleRows = await page.$$eval('.show-schedule-table-item', els =>
    els.map(e => ({
      day: e.querySelector('.show-schedule-table-item-title')?.textContent?.trim() || '',
      times: e.querySelector('.show-schedule-table-item-times')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    }))
  ).catch(() => [] as { day: string; times: string }[])

  const schedule = new Map<number, string[]>()
  for (const r of scheduleRows) {
    const idx = DAY_NAMES.findIndex(d => d.toLowerCase() === r.day.toLowerCase())
    if (idx < 0) continue
    const times = parseTimes(r.times)
    if (times.length) schedule.set(idx, times)
  }

  // Calendar: many open-run shows (Wicked, Lion King, Hamilton, MJ, SIX…) render
  // no weekly table — instead a live ticket calendar of real dated performances
  // as <a class="perf"> anchors. Each carries the exact date+time in its GA click
  // label ("…label':'2026_06_09_700pm'…") and a per-performance ticket URL in its
  // href (tickets.broadwaydirect.com/…). This is strictly better than fanning a
  // weekly pattern — actual dated, bookable performances — so we prefer it when
  // present. The calendar already shows only the upcoming ~4 weeks, a natural
  // bound. (We deliberately do NOT fall back to the body's show_schedule-* classes:
  // those are a superset taxonomy, not the live schedule, and would fabricate
  // performances on dark days.)
  const rawPerfs = await page.$$eval('a.perf', els =>
    els.map(e => {
      const oc = e.getAttribute('onclick') || ''
      const m = oc.match(/(\d{4})_(\d{2})_(\d{2})_(\d{1,2})(\d{2})(am|pm)/i)
      if (!m) return null
      return { y: m[1], mo: m[2], d: m[3], h: m[4], min: m[5], ap: m[6], href: (e as HTMLAnchorElement).href }
    }).filter((x): x is NonNullable<typeof x> => x !== null)
  ).catch(() => [] as { y: string; mo: string; d: string; h: string; min: string; ap: string; href: string }[])

  const calendarPerfs = rawPerfs.map(r => ({
    date: `${r.y}-${r.mo}-${r.d}`,
    time: `${parseInt(r.h, 10)}:${r.min} ${r.ap.toUpperCase()}`,
    ticketUrl: r.href
  }))

  return {
    venueName,
    posterUrl,
    description,
    performanceType: genreFromTitle(pageTitle),
    duration,
    schedule,
    calendarPerfs
  }
}

// Decide the [start, end] fan-out window for one show from its listing meta and
// today. Open runs use today → today+HORIZON. "On Sale Through X" caps the end.
// "Opens X" pushes the start (and yields nothing if the opening is past the
// horizon — the show simply isn't playing yet within our window).
function runWindow(meta: string, today: Date): { start: Date; end: Date; runEnd?: Date } {
  const horizonEnd = new Date(startOfDay(today).getTime() + HORIZON_DAYS * 86_400_000)
  let start = startOfDay(today)
  let end = horizonEnd
  let runEnd: Date | undefined

  const through = meta.match(/On Sale Through\s+(.+)/i)
  if (through) {
    const d = parseDatePhrase(through[1], today)
    if (d) {
      runEnd = d
      if (d < end) end = d
    }
  }
  const opens = meta.match(/Opens\s+(.+)/i)
  if (opens) {
    const d = parseDatePhrase(opens[1], today)
    if (d && d > start) start = d
  }
  return { start, end, runEnd }
}

async function scrape(page: Page): Promise<Partial<CsvRowInput>[]> {
  const browser = page.context().browser()
  if (!browser) throw new Error('[broadwayDirect] no browser handle on page context')

  // The orchestrator already navigated `page` to startUrl (config.waitFor
  // ensures .farlo-card is present). Grab every card before we navigate away.
  const cards: ListingCard[] = await page.$$eval('.farlo-card', els =>
    els.map(c => ({
      title: c.querySelector('.farlo-card__title')?.textContent?.trim() || '',
      href: (c.querySelector('.farlo-card__link') as HTMLAnchorElement | null)?.href
        || (c.querySelector('a') as HTMLAnchorElement | null)?.href || '',
      meta: c.querySelector('.farlo-card__meta')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    }))
  )

  const today = new Date()
  const rows: Partial<CsvRowInput>[] = []
  let skipped = 0

  for (const card of cards) {
    if (!card.title || !card.href) {
      skipped++
      continue
    }
    const detail = await scrapeDetail(browser, card)
    if (!detail || !detail.venueName) {
      // No venue = no reliable attribution; don't stage an orphan.
      console.warn(`[broadwayDirect] skip "${card.title}" — no venue (${detail ? 'detail ok' : 'detail failed'})`)
      skipped++
      continue
    }

    const { start, end, runEnd } = runWindow(card.meta, today)
    const runStart = ymd(start)
    const runEndStr = runEnd ? ymd(runEnd) : undefined

    const base: Partial<CsvRowInput> = {
      title: card.title,
      venueName: detail.venueName,
      venueCity: 'New York',
      venueState: 'NY',
      showUrl: card.href,
      ticketUrl: card.href,
      showPosterUrl: detail.posterUrl,
      showImageUrl: detail.posterUrl,
      showDescription: detail.description,
      performanceTypes: detail.performanceType,
      duration: detail.duration,
      runStartDate: runStart,
      runEndDate: runEndStr
    }

    let perfCount = 0
    let source = ''
    const endYmd = ymd(end)

    if (detail.calendarPerfs.length > 0) {
      // Real dated performances from the live calendar. Use them verbatim; each
      // carries its own per-performance ticket URL. Cap at the run window's end
      // (and never before its start) to stay within the rolling horizon.
      const startYmd = ymd(start)
      for (const perf of detail.calendarPerfs) {
        if (perf.date < startYmd || perf.date > endYmd) continue
        rows.push({ ...base, date: perf.date, time: perf.time, ticketUrl: perf.ticketUrl })
        perfCount++
      }
      source = ' [calendar]'
    } else if (detail.schedule.size > 0 && end >= start) {
      // Fan the weekly time pattern across [start, end].
      for (let t = startOfDay(start).getTime(); t <= end.getTime(); t += 86_400_000) {
        const day = new Date(t)
        const times = detail.schedule.get(day.getDay())
        if (!times) continue
        for (const time of times) {
          rows.push({ ...base, date: ymd(day), time })
          perfCount++
        }
      }
      source = ' [weekly table]'
    }

    // No dated performances (e.g. an opening past the horizon, or a page with
    // neither calendar nor table): keep one undated show record so the
    // title/venue/poster/description still reaches review.
    if (perfCount === 0) {
      rows.push(base)
      source = ' [show record only — no dated perfs in window]'
    }

    console.log(`[broadwayDirect] ${card.title} @ ${detail.venueName} — ${perfCount} performances${source}`)
  }

  console.log(`[broadwayDirect] ${cards.length} cards → ${rows.length} rows (${skipped} skipped)`)
  return rows
}

export const broadwayDirectScraper: VenueScraper = {
  id: 'broadway-direct',
  name: 'BroadwayDirect (broadwaydirect.com/shows)',
  startUrl: 'https://broadwaydirect.com/shows/',
  scrape
}
