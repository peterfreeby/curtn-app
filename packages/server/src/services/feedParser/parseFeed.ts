import Parser from 'rss-parser'
import ICAL from 'ical.js'
import {
  ParsedEvent,
  CleanupRules,
  applyCleanupRules,
  extractTimeFromDate,
  FETCH_TIMEOUT_MS,
  MAX_FEED_ITEMS,
  MAX_RESPONSE_BYTES,
  USER_AGENT
} from './shared'

export type { ParsedEvent, CleanupRules }
export { applyCleanupRules, extractTimeFromDate }

export async function parseRssFeed(url: string, rules: CleanupRules = {}): Promise<ParsedEvent[]> {
  const parser = new Parser({
    timeout: FETCH_TIMEOUT_MS,
    headers: { 'User-Agent': USER_AGENT }
  })
  const feed = await parser.parseURL(url)

  return (feed.items || []).slice(0, MAX_FEED_ITEMS).map(item => {
    const title = applyCleanupRules(item.title || 'Untitled', rules)
    const date = item.isoDate ? new Date(item.isoDate) : undefined

    return {
      title,
      description: item.contentSnippet || item.content || undefined,
      date,
      time: date ? extractTimeFromDate(date) : undefined,
      ticketUrl: item.link || undefined,
      rawData: {
        guid: item.guid,
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        content: item.content,
        categories: item.categories
      }
    }
  })
}

export async function parseIcalFeed(url: string, rules: CleanupRules = {}): Promise<ParsedEvent[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const response = await fetch(url, {
    signal: controller.signal,
    headers: { 'User-Agent': USER_AGENT }
  }).finally(() => clearTimeout(timeoutId))

  const contentLength = response.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
    throw new Error(`Feed too large: ${contentLength} bytes (max ${MAX_RESPONSE_BYTES})`)
  }

  const text = await response.text()
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new Error(`Feed too large: ${text.length} bytes (max ${MAX_RESPONSE_BYTES})`)
  }

  const jcalData = ICAL.parse(text)
  const comp = new ICAL.Component(jcalData)
  const vevents = comp.getAllSubcomponents('vevent')

  return vevents.slice(0, MAX_FEED_ITEMS).map(vevent => {
    const event = new ICAL.Event(vevent)
    const rawTitle = event.summary || 'Untitled'
    const title = applyCleanupRules(rawTitle, rules)
    const startDate = event.startDate?.toJSDate()

    return {
      title,
      description: event.description || undefined,
      date: startDate,
      time: startDate ? extractTimeFromDate(startDate) : undefined,
      ticketUrl: (event.component?.getFirstPropertyValue('url') as string) || undefined,
      rawData: {
        uid: event.uid,
        summary: event.summary,
        description: event.description,
        location: event.location,
        startDate: startDate?.toISOString(),
        endDate: event.endDate?.toJSDate()?.toISOString(),
        url: String(event.component?.getFirstPropertyValue('url') || '')
      }
    }
  })
}

function normalizeUrl(url: string): string {
  return url.replace(/^webcal:\/\//, 'https://')
}

export async function parseFeed(type: 'rss' | 'ical', url: string, rules: CleanupRules = {}): Promise<ParsedEvent[]> {
  const normalized = normalizeUrl(url)
  if (type === 'rss') return parseRssFeed(normalized, rules)
  if (type === 'ical') return parseIcalFeed(normalized, rules)
  throw new Error(`Unsupported feed type: ${type}`)
}
