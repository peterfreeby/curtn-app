import Parser from 'rss-parser'
import ICAL from 'ical.js'

export interface ParsedEvent {
  title: string
  description?: string
  date?: Date
  time?: string
  ticketUrl?: string
  rawData: Record<string, any>
}

export interface CleanupRules {
  stripPrefix?: string
  stripSuffix?: string
  defaultVenue?: string
  defaultStage?: string
  defaultCompany?: string
  defaultTypes?: string[]
  titleCase?: boolean
}

function applyTitleCase(str: string): string {
  const minor = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'at', 'by', 'in', 'of', 'on', 'to', 'up'])
  return str.split(' ').map((word, i) => {
    if (i === 0 || !minor.has(word.toLowerCase())) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    }
    return word.toLowerCase()
  }).join(' ')
}

function applyCleanupRules(title: string, rules: CleanupRules): string {
  let cleaned = title
  if (rules.stripPrefix && cleaned.startsWith(rules.stripPrefix)) {
    cleaned = cleaned.slice(rules.stripPrefix.length).trim()
  }
  if (rules.stripSuffix && cleaned.endsWith(rules.stripSuffix)) {
    cleaned = cleaned.slice(0, -rules.stripSuffix.length).trim()
  }
  if (rules.titleCase) {
    cleaned = applyTitleCase(cleaned)
  }
  return cleaned
}

function extractTimeFromDate(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`
}

const FETCH_TIMEOUT_MS = 15000
const MAX_FEED_ITEMS = 200
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024 // 5MB
const USER_AGENT = 'Curtn/1.0 (https://curtn.com; data-feed-reader)'

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
