import * as cheerio from 'cheerio'
import { ParsedEvent, applyCleanupRules, extractTimeFromDate } from '../feedParser/shared'
import { ParsingTemplate, SelectorRule, CreditSelectorRule } from './types'
import { extractJsonLd, JsonLdEvent } from './extractJsonLd'

const DEFAULT_JSON_LD_FIELD_MAP: Record<string, string> = {
  name: 'title',
  description: 'description',
  startDate: 'date',
  'location.name': 'venue',
  url: 'ticketUrl',
  image: 'imageUrl'
}

function resolveUrl(relative: string | undefined, baseUrl: string): string | undefined {
  if (!relative) return undefined
  try {
    return new URL(relative, baseUrl).toString()
  } catch {
    return relative
  }
}

function applyRegex(text: string, pattern: string): string {
  try {
    const match = text.match(new RegExp(pattern))
    return match?.[1] ?? match?.[0] ?? text
  } catch {
    return text
  }
}

function applyTransform(value: string, transform: SelectorRule['transform']): string | Date | undefined {
  if (!transform) return value

  switch (transform) {
    case 'trim':
      return value.trim()
    case 'date':
    case 'datetime': {
      const parsed = new Date(value)
      return isNaN(parsed.getTime()) ? undefined : parsed as any
    }
    case 'time':
      return value.trim()
    case 'currency':
      return value.replace(/[^\d.,]/g, '').trim()
    default:
      return value
  }
}

function extractWithRule(
  $: any,
  context: any,
  rule: SelectorRule
): string | undefined {
  const el = context.find(rule.selector).first()
  if (!el.length) return undefined

  let value: string
  if (rule.attribute) {
    value = el.attr(rule.attribute) || ''
  } else {
    value = el.text().trim()
  }

  if (!value) return undefined

  if (rule.regex) {
    value = applyRegex(value, rule.regex)
  }

  return value
}

function jsonLdEventToParsedEvent(jsonLd: JsonLdEvent, fieldMap: Record<string, string>, sourceUrl: string): ParsedEvent | null {
  const mapped: Record<string, any> = {}

  for (const [jsonLdPath, curtnField] of Object.entries(fieldMap)) {
    let value: any = jsonLd
    for (const key of jsonLdPath.split('.')) {
      value = value?.[key]
    }
    if (value !== undefined && value !== null) {
      mapped[curtnField] = value
    }
  }

  // Handle image which can be a string or an object
  if (jsonLd.image) {
    mapped.imageUrl = typeof jsonLd.image === 'string' ? jsonLd.image : jsonLd.image.url
  }

  // Handle offers for ticket URL and price
  const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers
  if (offers) {
    if (!mapped.ticketUrl && offers.url) mapped.ticketUrl = offers.url
    if (offers.price !== undefined) mapped.price = String(offers.price)
  }

  if (!mapped.title) return null

  let date: Date | undefined
  let time: string | undefined
  if (mapped.date) {
    const parsed = new Date(mapped.date)
    if (!isNaN(parsed.getTime())) {
      date = parsed
      time = extractTimeFromDate(parsed)
    }
  }

  return {
    title: String(mapped.title),
    description: mapped.description ? String(mapped.description) : undefined,
    date,
    time,
    ticketUrl: resolveUrl(mapped.ticketUrl, sourceUrl),
    rawData: { jsonLd, extractionMethod: 'json-ld' }
  }
}

export function applyTemplate(html: string, template: ParsingTemplate, sourceUrl: string): ParsedEvent[] {
  // Try JSON-LD extraction first if enabled
  if (template.useJsonLd) {
    const jsonLdEvents = extractJsonLd(html)
    if (jsonLdEvents.length > 0) {
      const fieldMap = { ...DEFAULT_JSON_LD_FIELD_MAP, ...template.jsonLdFieldMap }
      const events = jsonLdEvents
        .map(e => jsonLdEventToParsedEvent(e, fieldMap, sourceUrl))
        .filter((e): e is ParsedEvent => e !== null)

      if (events.length > 0) {
        // Apply cleanup rules if configured
        if (template.cleanup) {
          for (const event of events) {
            event.title = applyCleanupRules(event.title, template.cleanup)
          }
        }
        return events
      }
    }
    // Fall through to CSS selector extraction if JSON-LD didn't produce results
  }

  const $ = cheerio.load(html)
  const events: ParsedEvent[] = []

  // Determine contexts: either list items or the whole document
  let contexts: any[]
  if (template.listSelector) {
    contexts = []
    $(template.listSelector).each((_i, el) => {
      contexts.push($(el))
    })
  } else {
    contexts = [$.root()]
  }

  for (const context of contexts) {
    const { selectors } = template

    const titleRaw = extractWithRule($, context, selectors.title)
    if (!titleRaw) continue // Skip items without a title

    let title = titleRaw
    if (template.cleanup) {
      title = applyCleanupRules(title, template.cleanup)
    }

    // Extract date
    let date: Date | undefined
    let time: string | undefined
    if (selectors.date) {
      const dateRaw = extractWithRule($, context, selectors.date)
      if (dateRaw) {
        const transformed = applyTransform(dateRaw, selectors.date.transform || 'date')
        if (transformed instanceof Date) {
          date = transformed
          // If no separate time selector, try to extract time from the date
          if (!selectors.time) {
            time = extractTimeFromDate(date)
          }
        }
      }
    }

    if (selectors.time) {
      const timeRaw = extractWithRule($, context, selectors.time)
      if (timeRaw) {
        time = String(applyTransform(timeRaw, selectors.time.transform || 'time'))
      }
    }

    const venue = selectors.venue ? extractWithRule($, context, selectors.venue) : undefined
    const description = selectors.description ? extractWithRule($, context, selectors.description) : undefined
    const ticketUrlRaw = selectors.ticketUrl ? extractWithRule($, context, selectors.ticketUrl) : undefined
    const imageUrlRaw = selectors.imageUrl ? extractWithRule($, context, selectors.imageUrl) : undefined
    const price = selectors.price ? extractWithRule($, context, selectors.price) : undefined

    // Extended fields
    const runTitle = selectors.runTitle ? extractWithRule($, context, selectors.runTitle) : undefined
    const showDescription = selectors.showDescription ? extractWithRule($, context, selectors.showDescription) : undefined
    const runDescription = selectors.runDescription ? extractWithRule($, context, selectors.runDescription) : undefined

    let duration: number | undefined
    if (selectors.duration) {
      const durationRaw = extractWithRule($, context, selectors.duration)
      if (durationRaw) {
        const parsed = parseInt(durationRaw.replace(/[^\d]/g, ''), 10)
        if (!isNaN(parsed)) duration = parsed
      }
    }

    let startDate: Date | undefined
    let endDate: Date | undefined
    if (selectors.startDate) {
      const raw = extractWithRule($, context, selectors.startDate)
      if (raw) {
        const parsed = new Date(raw)
        if (!isNaN(parsed.getTime())) startDate = parsed
      }
    }
    if (selectors.endDate) {
      const raw = extractWithRule($, context, selectors.endDate)
      if (raw) {
        const parsed = new Date(raw)
        if (!isNaN(parsed.getTime())) endDate = parsed
      }
    }

    // Credits extraction
    let credits: { name: string; role?: string; headshotUrl?: string }[] | undefined
    if (template.credits?.containerSelector) {
      credits = []
      context.find(template.credits.containerSelector).each((_i: number, el: any) => {
        const creditEl = $(el)
        const name = creditEl.find(template.credits!.nameSelector).text().trim()
        if (!name) return
        const role = template.credits!.roleSelector
          ? creditEl.find(template.credits!.roleSelector).text().trim() || undefined
          : undefined
        let headshotUrl: string | undefined
        if (template.credits!.headshotSelector) {
          const img = creditEl.find(template.credits!.headshotSelector).first()
          const src = img.attr('src') || img.attr('data-src') || undefined
          headshotUrl = resolveUrl(src, sourceUrl)
        }
        credits!.push({ name, role, headshotUrl })
      })
      if (credits.length === 0) credits = undefined
    }

    events.push({
      title,
      description: description || showDescription,
      date,
      time,
      ticketUrl: resolveUrl(ticketUrlRaw, sourceUrl),
      imageUrl: resolveUrl(imageUrlRaw, sourceUrl),
      runTitle,
      showDescription,
      runDescription,
      duration,
      startDate,
      endDate,
      credits,
      rawData: {
        extractionMethod: 'css-selector',
        price,
        venue,
        sourceUrl
      }
    })
  }

  return events
}
