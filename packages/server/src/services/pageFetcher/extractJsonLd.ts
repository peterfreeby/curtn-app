import * as cheerio from 'cheerio'

const EVENT_TYPES = new Set([
  'Event', 'TheaterEvent', 'MusicEvent', 'DanceEvent', 'ComedyEvent',
  'Festival', 'SocialEvent', 'ScreeningEvent'
])

export interface JsonLdEvent {
  '@type': string
  name?: string
  description?: string
  startDate?: string
  endDate?: string
  location?: {
    '@type'?: string
    name?: string
    address?: any
  }
  url?: string
  image?: string | { url?: string }
  offers?: {
    url?: string
    price?: string | number
    priceCurrency?: string
  } | Array<{
    url?: string
    price?: string | number
    priceCurrency?: string
  }>
  performer?: any
  organizer?: any
}

export function extractJsonLd(html: string): JsonLdEvent[] {
  const $ = cheerio.load(html)
  const events: JsonLdEvent[] = []

  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const text = $(el).html()
      if (!text) return

      const data = JSON.parse(text)

      // Handle single objects
      if (data['@type'] && EVENT_TYPES.has(data['@type'])) {
        events.push(data)
        return
      }

      // Handle @graph arrays
      if (data['@graph'] && Array.isArray(data['@graph'])) {
        for (const item of data['@graph']) {
          if (item['@type'] && EVENT_TYPES.has(item['@type'])) {
            events.push(item)
          }
        }
        return
      }

      // Handle plain arrays
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item['@type'] && EVENT_TYPES.has(item['@type'])) {
            events.push(item)
          }
        }
      }
    } catch {
      // Malformed JSON-LD — skip this block
    }
  })

  return events
}
