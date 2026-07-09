import type { Page } from 'playwright'
import type { CsvRowInput } from '../../importEngine'
import type { VenueScraper } from '../types'

// Tier 3 (code) — Comedy Cellar, New York (comedycellar.com).
//
// Why code, not JSON-LD / template: comedycellar.com/new-york-line-up/ carries
// no JSON-LD and no server-rendered event DOM. The lineup is hydrated by the
// "comedy-lineup" WordPress plugin, which POSTs to /lineup/api/ per date and
// gets back { show: { html }, date, dates } — an HTML blob of that night's
// shows. We navigate to the lineup page (so the fetch is same-origin), then
// call the API for each date the picker exposes and parse each blob into rows.
//
// Each blob has one .set-header per time-slot show (title + time), each paired
// with a .lineup[data-set-content=<id>] holding the cast (.set-content → img
// headshot, .name, bio <p>, .website link) plus a .make-reservation link.
//
// Poster: Comedy Cellar publishes no per-show poster art — only ~70×70
// comedian headshots. We leave showImageUrl/showPosterUrl empty on purpose:
// Curtn's PosterCard renders its typographic title-card (TextPoster) as the
// fallback for any show with no image. Cast headshots still flow through as
// personHeadshotUrl (we strip WordPress's -WxH thumbnail suffix to grab the
// full-size original).

const VENUE_NAME = 'Comedy Cellar'
const VENUE_ADDRESS = '117 MacDougal St'
const VENUE_CITY = 'New York'
const VENUE_STATE = 'NY'
const VENUE_ZIP = '10012'
const ORIGIN = 'https://www.comedycellar.com'

// How many days of the picker to pull. The picker exposes ~28 days (4 weeks).
// Kept as a constant so the horizon can be trimmed to avoid flooding review.
const DAYS = 28

// The physical rooms. When a show's title starts with one of these it's the
// room's nightly bill (title == stage); anything else is a named special
// (e.g. "An Hour with Jim Norton") whose room isn't encoded in the data.
const ROOMS = ['MacDougal Street', 'Village Underground', 'Fat Black Pussycat']

interface RawCast {
  name: string
  bio: string
  web: string
  img: string
}
interface RawShow {
  time: string
  title: string
  cast: RawCast[]
  resv: string
}

// Call the plugin API for one date (or "today") and return the raw show list,
// parsed from the returned HTML blob inside the browser (DOMParser).
async function fetchDay(page: Page, date: string): Promise<{ date: string; dates: string[]; shows: RawShow[] }> {
  // NB: the in-page function deliberately uses Promise chaining (no async/await).
  // ts-node transpiles an `async` callback with an `__awaiter` helper that does
  // not exist in the browser context, which throws "__awaiter is not defined".
  return page.evaluate((date) => {
    const body = 'action=cc_get_shows&json=' + encodeURIComponent(JSON.stringify({ date, venue: 'newyork', type: 'lineup' }))
    return fetch('/lineup/api/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })
      .then((res) => res.json())
      .then((j) => {
        const html: string = (j && j.show && j.show.html) || ''
        const doc = new DOMParser().parseFromString(html, 'text/html')
        const shows: RawShow[] = []
        doc.querySelectorAll('.set-header').forEach((sh) => {
          const time = (sh.querySelector('.bold')?.textContent || '').trim()
          const title = (sh.querySelector('.title')?.textContent || '').trim()
          const id = sh.querySelector('.lineup-toggle')?.getAttribute('data-lineup-id') || ''
          const content = doc.querySelector('.lineup[data-set-content="' + id + '"]')
          const cast: RawCast[] = []
          content?.querySelectorAll('.set-content').forEach((sc) => {
            const name = (sc.querySelector('.name')?.textContent || '').trim()
            if (!name) return
            let bio = ''
            sc.querySelectorAll('p:not(.website)').forEach((p) => { bio += ' ' + (p.textContent || '') })
            bio = bio.replace(name, '').replace(/\s+/g, ' ').trim()
            const web = sc.querySelector('.website a')?.getAttribute('href') || ''
            const img = sc.querySelector('img')?.getAttribute('src') || ''
            cast.push({ name, bio, web, img })
          })
          const resv = content?.querySelector('.make-reservation a')?.getAttribute('href') || ''
          shows.push({ time, title, cast, resv })
        })
        return { date: (j && j.date) || date, dates: Object.keys((j && j.dates) || {}), shows }
      })
  }, date)
}

// "7:00 pm show" → "7:00 PM"
function cleanTime(raw: string): string | undefined {
  const m = raw.match(/(\d{1,2}:\d{2})\s*(am|pm)/i)
  if (!m) return undefined
  return `${m[1]} ${m[2].toUpperCase()}`
}

// Strip WordPress's -WxH thumbnail suffix to get the full-size original, and
// make the URL absolute. Drop the "photo coming soon" placeholder entirely.
function fullImage(src: string): string | undefined {
  if (!src) return undefined
  if (/Updating-Credits|placeholder|coming-soon/i.test(src)) return undefined
  const abs = src.startsWith('http') ? src : ORIGIN + (src.startsWith('/') ? '' : '/') + src
  return abs.replace(/-\d+x\d+(\.\w+)(\?.*)?$/, '$1')
}

function roomFor(title: string): string | undefined {
  return ROOMS.find((r) => title.startsWith(r))
}

function buildDescription(title: string, room: string | undefined, cast: RawCast[]): string {
  const names = cast.map((c) => c.name).filter(Boolean)
  const where = room ? `Comedy Cellar's ${room} room` : 'Comedy Cellar'
  const lead = names.length
    ? `Stand-up at ${where}, featuring ${names.join(', ')}.`
    : `Stand-up at ${where}.`
  const bios = cast
    .filter((c) => c.bio)
    .map((c) => `${c.name} — ${c.bio}`)
    .join('\n')
  return bios ? `${lead}\n\n${bios}` : lead
}

async function scrape(page: Page): Promise<Partial<CsvRowInput>[]> {
  // Discover the date horizon from the first (today) call.
  const first = await fetchDay(page, 'today')
  const allDates = first.dates.length ? first.dates : [first.date]
  const targetDates = allDates.slice(0, DAYS)

  const rows: Partial<CsvRowInput>[] = []
  let showCount = 0

  for (const date of targetDates) {
    // Reuse the already-parsed "today" payload for the first date.
    const day = date === first.date ? first : await fetchDay(page, date)

    // Collision-only time disambiguation. The import engine allows one
    // performance per (title, date) — so a room that runs several sets a night
    // (MacDougal Street, Village Underground, Fat Black Pussycat …) would
    // collapse into one jumbled event. When a title appears more than once on
    // the same day, append the showtime to keep each set a distinct
    // performance. Genuinely unique shows ("An Hour with Jim Norton") don't
    // collide and keep a clean title. (The systemic fix — adding time to the
    // dedup key — is a separate shared-engine change.)
    const titleCountsToday = new Map<string, number>()
    for (const s of day.shows) {
      if (s.title) titleCountsToday.set(s.title, (titleCountsToday.get(s.title) || 0) + 1)
    }

    for (const show of day.shows) {
      if (!show.title) continue
      const time = cleanTime(show.time)
      const room = roomFor(show.title)
      const description = buildDescription(show.title, room, show.cast)
      const ticketUrl = show.resv ? (show.resv.startsWith('http') ? show.resv : ORIGIN + show.resv) : undefined
      const collides = (titleCountsToday.get(show.title) || 0) > 1
      const eventTitle = collides && time ? `${show.title} — ${time}` : show.title

      const base: Partial<CsvRowInput> = {
        title: eventTitle,
        venueName: VENUE_NAME,
        venueAddress: VENUE_ADDRESS,
        venueCity: VENUE_CITY,
        venueState: VENUE_STATE,
        venueZipCode: VENUE_ZIP,
        stageName: room,
        performanceTypes: 'comedy',
        date: day.date,
        time,
        ticketUrl,
        showUrl: `${ORIGIN}/new-york-line-up/`,
        showDescription: description
        // showImageUrl / showPosterUrl intentionally omitted → title-card fallback.
      }
      showCount++

      const namedCast = show.cast.filter((c) => c.name)
      if (namedCast.length === 0) {
        rows.push(base)
        continue
      }
      // Fan out one row per comedian; the staging layer regroups these into a
      // single event with a populated cast array.
      for (const c of namedCast) {
        rows.push({
          ...base,
          personName: c.name,
          personRole: 'Comedian',
          creditType: 'cast',
          personHeadshotUrl: fullImage(c.img)
        })
      }
    }
  }

  console.log(`[comedyCellar] ${targetDates.length} days → ${showCount} shows → ${rows.length} rows`)
  return rows
}

export const comedyCellarScraper: VenueScraper = {
  id: 'comedy-cellar',
  name: 'Comedy Cellar (comedycellar.com)',
  startUrl: 'https://www.comedycellar.com/new-york-line-up/',
  scrape
}
