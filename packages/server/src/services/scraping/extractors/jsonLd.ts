import type { Page } from 'playwright'
import type { CsvRowInput } from '../../importEngine'
import type { Extractor } from '../types'

const EVENT_TYPES = new Set([
  'Event',
  'TheaterEvent',
  'TheatreEvent',
  'MusicEvent',
  'DanceEvent',
  'ComedyEvent',
  'Festival',
  'ScreeningEvent',
  'BusinessEvent',
  'SocialEvent',
  'EducationEvent',
  'ChildrensEvent',
  'VisualArtsEvent',
  'LiteraryEvent'
])

const EVENT_TYPE_TO_PERFORMANCE_TYPE: Record<string, string> = {
  TheaterEvent: 'theater',
  TheatreEvent: 'theater',
  MusicEvent: 'musical',
  DanceEvent: 'dance',
  ComedyEvent: 'comedy',
  ScreeningEvent: 'other',
  Festival: 'other',
  LiteraryEvent: 'spoken-word',
  VisualArtsEvent: 'experimental'
}

function isEventType(type: unknown): boolean {
  if (typeof type === 'string') return EVENT_TYPES.has(type)
  if (Array.isArray(type)) return type.some(t => typeof t === 'string' && EVENT_TYPES.has(t))
  return false
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined
  return undefined
}

function asUrl(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined
  if (v && typeof v === 'object' && 'url' in v) return asString((v as any).url)
  return undefined
}

// Resolve schema.org image which may be a string, ImageObject, or array
function asImage(v: unknown): string | undefined {
  if (!v) return undefined
  if (typeof v === 'string') return v.trim() || undefined
  if (Array.isArray(v)) return asImage(v[0])
  if (typeof v === 'object' && 'url' in v) return asString((v as any).url)
  return undefined
}

// Schema.org dates can be ISO 8601 strings; we keep them as-is for parseDate downstream.
function extractDate(startDate: unknown): { date?: string; time?: string } {
  const s = asString(startDate)
  if (!s) return {}
  // ISO with time
  if (s.includes('T')) {
    const d = new Date(s)
    if (isNaN(d.getTime())) return { date: s }
    const hours = d.getHours()
    const minutes = d.getMinutes()
    if (hours === 0 && minutes === 0) {
      // Date-only or midnight — don't synthesize a time
      return { date: s.split('T')[0] }
    }
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const h = hours % 12 || 12
    const time = `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`
    return { date: s.split('T')[0], time }
  }
  return { date: s }
}

function extractVenue(location: unknown): { venueName?: string; venueAddress?: string; venueCity?: string; venueState?: string; venueZipCode?: string } {
  if (!location) return {}
  if (typeof location === 'string') return { venueName: location.trim() }
  if (Array.isArray(location)) return extractVenue(location[0])
  if (typeof location !== 'object') return {}

  const loc = location as any
  const out: ReturnType<typeof extractVenue> = {}
  out.venueName = asString(loc.name)

  const addr = loc.address
  if (typeof addr === 'string') {
    out.venueAddress = addr.trim()
  } else if (addr && typeof addr === 'object') {
    out.venueAddress = asString(addr.streetAddress)
    out.venueCity = asString(addr.addressLocality)
    out.venueState = asString(addr.addressRegion)
    out.venueZipCode = asString(addr.postalCode)
  }
  return out
}

function extractOffers(offers: unknown): string | undefined {
  if (!offers) return undefined
  if (Array.isArray(offers)) {
    for (const o of offers) {
      const url = asUrl((o as any)?.url)
      if (url) return url
    }
    return undefined
  }
  if (typeof offers === 'object') {
    return asUrl((offers as any).url)
  }
  return undefined
}

function extractPerformer(performer: unknown): { personName?: string; creditType?: string }[] {
  if (!performer) return []
  if (Array.isArray(performer)) return performer.flatMap(extractPerformer)
  if (typeof performer === 'string') {
    const name = performer.trim()
    return name ? [{ personName: name, creditType: 'cast' }] : []
  }
  if (typeof performer === 'object') {
    const name = asString((performer as any).name)
    return name ? [{ personName: name, creditType: 'cast' }] : []
  }
  return []
}

function eventToRows(event: any): Partial<CsvRowInput>[] {
  const title = asString(event.name)
  if (!title) return []

  const { date, time } = extractDate(event.startDate)
  const venue = extractVenue(event.location)
  const ticketUrl = extractOffers(event.offers) || asUrl(event.url)
  const image = asImage(event.image)
  const description = asString(event.description)

  // Map @type to performance type
  let performanceType: string | undefined
  const t = event['@type']
  if (typeof t === 'string') performanceType = EVENT_TYPE_TO_PERFORMANCE_TYPE[t]
  else if (Array.isArray(t)) {
    for (const tt of t) {
      if (typeof tt === 'string' && EVENT_TYPE_TO_PERFORMANCE_TYPE[tt]) {
        performanceType = EVENT_TYPE_TO_PERFORMANCE_TYPE[tt]
        break
      }
    }
  }

  const baseRow: Partial<CsvRowInput> = {
    title,
    showDescription: description,
    performanceTypes: performanceType,
    date,
    time,
    ticketUrl,
    showImageUrl: image,
    performanceImageUrl: image,
    ...venue
  }

  const performers = extractPerformer(event.performer)
  if (performers.length === 0) return [baseRow]
  // Each performer becomes its own row sharing the show identity (title + date + venue)
  // so the staging helper groups them into the same PendingImport's cast array.
  return performers.map(p => ({ ...baseRow, ...p }))
}

// Recursively walk JSON-LD nodes (handles @graph wrappers and nested arrays).
function* walkNodes(node: any): Generator<any> {
  if (!node) return
  if (Array.isArray(node)) {
    for (const n of node) yield* walkNodes(n)
    return
  }
  if (typeof node !== 'object') return
  if (node['@graph']) {
    yield* walkNodes(node['@graph'])
    return
  }
  yield node
}

export const jsonLdExtractor: Extractor = {
  async extract(page, _sourceUrl) {
    const blobs = await page.$$eval(
      'script[type="application/ld+json"]',
      (nodes) => nodes.map(n => n.textContent || '')
    )

    const rows: Partial<CsvRowInput>[] = []
    for (const blob of blobs) {
      let parsed: unknown
      try {
        parsed = JSON.parse(blob)
      } catch {
        continue
      }
      for (const node of walkNodes(parsed)) {
        if (isEventType(node['@type'])) {
          rows.push(...eventToRows(node))
        }
      }
    }
    return rows
  }
}

// Quick probe variant — used by the probe command to count event nodes
// without going through the full extraction logic.
export async function findJsonLdEvents(page: Page): Promise<{ count: number; types: string[] }> {
  const blobs = await page.$$eval(
    'script[type="application/ld+json"]',
    (nodes) => nodes.map(n => n.textContent || '')
  )
  let count = 0
  const types = new Set<string>()
  for (const blob of blobs) {
    try {
      const parsed = JSON.parse(blob)
      for (const node of walkNodes(parsed)) {
        if (isEventType(node['@type'])) {
          count++
          const t = node['@type']
          if (typeof t === 'string') types.add(t)
          else if (Array.isArray(t)) t.forEach(tt => typeof tt === 'string' && types.add(tt))
        }
      }
    } catch { /* skip malformed */ }
  }
  return { count, types: Array.from(types) }
}
