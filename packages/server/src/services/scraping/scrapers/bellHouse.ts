import type { Page } from 'playwright'
import type { CsvRowInput } from '../../importEngine'
import type { VenueScraper } from '../types'

// Tier 3 (code) — The Bell House, Gowanus (Brooklyn).
//
// Why code, not JSON-LD: thebellhouseny.com is a Next.js app whose /shows page
// is powered by Live Nation / Ticketmaster. The page's JSON-LD carries
// title/date/image/ticket-url but NO description, and every event links out to
// ticketmaster.com (bot-walled) — so there is no venue detail page to follow.
//
// The real per-event blurb lives in the `important_info` field of the event
// objects embedded in the Next.js flight payload (`self.__next_f.push([...])`),
// which never renders into the card DOM. We decode that payload here: each
// push arg is a JSON string literal, so concatenating the parsed chunks
// reconstructs the RSC stream, then we slice out each discovery event object
// and read its fields directly.

const VENUE_NAME = 'The Bell House'
const VENUE_ADDRESS = '149 7th St'
const VENUE_CITY = 'Brooklyn'
const VENUE_STATE = 'NY'
const VENUE_ZIP = '11215'

// Reconstruct the Next.js flight stream from the HTML. Each
// `self.__next_f.push([n,"...."])` second arg is a JSON string literal; parsing
// and concatenating them yields the stream with real (unescaped) quotes.
function decodeFlight(html: string): string {
  const re = /self\.__next_f\.push\(\[\d+,("(?:[^"\\]|\\.)*")\]\)/g
  let m: RegExpExecArray | null
  let out = ''
  while ((m = re.exec(html))) {
    try {
      out += JSON.parse(m[1])
    } catch {
      // skip a chunk that isn't a clean string literal
    }
  }
  return out
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&#039;': "'", '&apos;': "'", '&nbsp;': ' ',
  '&rsquo;': '’', '&lsquo;': '‘', '&rdquo;': '”',
  '&ldquo;': '“', '&hellip;': '…', '&mdash;': '—',
  '&ndash;': '–', '&eacute;': 'é'
}

function decodeEntities(s: string): string {
  let out = s.replace(/&(?:amp|lt|gt|quot|#0?39|apos|nbsp|rsquo|lsquo|rdquo|ldquo|hellip|mdash|ndash|eacute);/g, m => ENTITIES[m] ?? m)
  out = out.replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
  return out.replace(/\s+/g, ' ').trim()
}

// "20:00:00" → "8:00 PM"
function formatTime(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const m = raw.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return undefined
  let h = parseInt(m[1], 10)
  const min = m[2]
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${min} ${ampm}`
}

function inferType(genre: string, segment: string): string {
  const blob = `${genre} ${segment}`.toLowerCase()
  if (/comedy/.test(blob)) return 'comedy'
  if (/theat/.test(blob)) return 'theater'
  if (/dance/.test(blob)) return 'dance'
  // Everything else at The Bell House is a concert / live music bill.
  return 'music'
}

function field(seg: string, key: string): string | undefined {
  const m = seg.match(new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`))
  if (!m) return undefined
  try {
    return JSON.parse(`"${m[1]}"`)
  } catch {
    return m[1]
  }
}

async function scrape(page: Page): Promise<Partial<CsvRowInput>[]> {
  const html = await page.content()
  const raw = decodeFlight(html)
  const segments = raw.split('"event_data_type":"discovery"').slice(1)

  const rows: Partial<CsvRowInput>[] = []
  const seen = new Set<string>()
  let skipped = 0

  for (const full of segments) {
    // Only read the current event's own object — cut at the next event boundary
    // and at the nested `similar_events` array so we don't pull a neighbour's
    // fields.
    const seg = full.split('"similar_events"')[0]

    const tmId = field(seg, 'tm_id')
    const name = field(seg, 'name')
    const url = field(seg, 'url')
    const date = field(seg, 'start_date_local')
    const time = formatTime(field(seg, 'start_time_local'))
    const genre = field(seg, 'genre') || ''
    const segment = field(seg, 'segment') || ''
    const infoRaw = field(seg, 'important_info')
    const description = infoRaw ? decodeEntities(infoRaw) : undefined

    // Prefer the large 16:9 landscape poster; fall back to the first image.
    let image = seg.match(/"url":"(https:\/\/[^"]*LARGE_16_9\.jpg)"/)?.[1]
    if (!image) image = seg.match(/"url":"(https:\/\/s1\.ticketm\.net\/[^"]+\.jpg)"/)?.[1]

    if (!name || !date) {
      skipped++
      continue
    }
    // Quality bar: a row without a description isn't shippable for this venue.
    if (!description || description.length < 20) {
      console.warn(`[bellHouse] skip "${name}" (${date}) — no description`)
      skipped++
      continue
    }
    const dedupe = `${tmId || name}|${date}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)

    rows.push({
      title: name,
      venueName: VENUE_NAME,
      venueAddress: VENUE_ADDRESS,
      venueCity: VENUE_CITY,
      venueState: VENUE_STATE,
      venueZipCode: VENUE_ZIP,
      performanceTypes: inferType(genre, segment),
      date,
      time,
      ticketUrl: url,
      showUrl: url,
      showImageUrl: image,
      performanceImageUrl: image,
      showPosterUrl: image,
      showDescription: description
    })
  }

  console.log(`[bellHouse] ${segments.length} events → ${rows.length} rows (${skipped} skipped)`)
  return rows
}

export const bellHouseScraper: VenueScraper = {
  id: 'bell-house',
  name: 'The Bell House (thebellhouseny.com)',
  startUrl: 'https://www.thebellhouseny.com/shows',
  scrape
}
