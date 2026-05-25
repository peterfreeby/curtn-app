import * as cheerio from 'cheerio'
import { V2ParsingTemplate, TemplateNode, FieldNode, ContainerNode } from './v2Types'
import { extractJsonLd } from './extractJsonLd'
import { applyCleanupRules } from '../feedParser/shared'
import { parseDateRange } from './dateRange'
import type { CsvRowInput } from '../importEngine'

// A flat row matching CsvRowInput shape — all string values
type FlatRow = Record<string, string | undefined>

function resolveUrl(relative: string | undefined, baseUrl: string): string | undefined {
  if (!relative) return undefined
  try {
    return new URL(relative, baseUrl).toString()
  } catch {
    return relative
  }
}

// Fields that contain URLs and need resolution
const URL_FIELDS = new Set([
  'showUrl', 'showImageUrl', 'showPosterUrl',
  'venueWebsite', 'venueImageUrl',
  'runImageUrl', 'runPosterUrl',
  'ticketUrl', 'performanceImageUrl',
  'companyLogoUrl', 'personHeadshotUrl'
])

function extractFieldValue(
  field: FieldNode,
  context: any,
  $: any,
  sourceUrl: string
): string | undefined {
  // Static value
  if (field.staticValue !== undefined) return field.staticValue

  // Preset value (entity name)
  if (field.presetValue !== undefined) return field.presetValue

  // CSS selector extraction
  if (!field.selector) return undefined
  // ":scope" / ":self" → the container element itself (handy for reading data-*
  // attributes off a card's wrapper). Cheerio's .find() only walks descendants,
  // so this special case routes around it.
  const el =
    field.selector === ':scope' || field.selector === ':self'
      ? context
      : context.find(field.selector).first()
  if (!el.length) return undefined

  let value: string
  if (field.attribute) {
    value = el.attr(field.attribute) || ''
    // For images, try fallbacks
    if (!value && field.attribute === 'src') {
      value = el.attr('data-src') || ''
      if (!value) {
        const srcset = el.attr('srcset') || el.attr('data-srcset') || ''
        const firstEntry = srcset.split(',')[0]?.trim().split(/\s+/)[0]
        if (firstEntry) value = firstEntry
      }
    }
  } else {
    value = el.text().trim()
  }

  if (!value) return undefined

  // Apply regex
  if (field.regex) {
    try {
      const match = value.match(new RegExp(field.regex))
      value = match?.[1] ?? match?.[0] ?? value
    } catch { /* invalid regex, use raw value */ }
  }

  // Apply transform
  if (field.transform) {
    switch (field.transform) {
      case 'trim':
        value = value.trim()
        break
      case 'date':
      case 'datetime': {
        const hasYear = /\b(19|20)\d{2}\b/.test(value)
        const parsed = new Date(value)
        if (!isNaN(parsed.getTime())) {
          if (!hasYear) {
            // Caveat ("FRI, MAY 8") and many calendar pages omit the year.
            // V8's Date defaults to 2001 in that case. Infer current year;
            // if the resulting date is >30d in the past, roll to next year.
            const now = new Date()
            parsed.setFullYear(now.getFullYear())
            const daysAgo = (now.getTime() - parsed.getTime()) / 86_400_000
            if (daysAgo > 30) parsed.setFullYear(now.getFullYear() + 1)
          }
          value = parsed.toISOString()
        }
        break
      }
      case 'date-range-start':
      case 'date-range-end': {
        const d = parseDateRange(value, field.transform === 'date-range-start' ? 'start' : 'end')
        if (d) value = d.toISOString()
        break
      }
      case 'time':
        value = value.trim()
        break
      case 'currency':
        value = value.replace(/[^\d.,]/g, '').trim()
        break
    }
  }

  // Resolve URLs for known URL fields
  if (URL_FIELDS.has(field.csvField)) {
    value = resolveUrl(value, sourceUrl) || value
  }

  return value
}

function walkNodes(
  nodes: TemplateNode[],
  context: any,
  $: any,
  sourceUrl: string,
  baseRow: FlatRow
): FlatRow[] {
  const fieldNodes = nodes.filter((n): n is FieldNode => n.type === 'field')
  const containerNodes = nodes.filter((n): n is ContainerNode => n.type === 'container')

  // Extract all field values at this level into the current row
  const currentRow: FlatRow = { ...baseRow }
  for (const field of fieldNodes) {
    const value = extractFieldValue(field, context, $, sourceUrl)
    if (value !== undefined) {
      currentRow[field.csvField] = value
    }
  }

  // If no containers at this level, return a single row
  if (containerNodes.length === 0) {
    return [currentRow]
  }

  // For each container, iterate matched elements and recurse
  const rows: FlatRow[] = []
  for (const container of containerNodes) {
    const elements: any[] = []
    context.find(container.selector).each((_i: number, el: any) => {
      elements.push($(el))
    })

    if (elements.length === 0) continue

    for (const el of elements) {
      const childRows = walkNodes(container.children, el, $, sourceUrl, currentRow)
      rows.push(...childRows)
    }
  }

  // If containers produced no rows (all empty), still return the base row
  // so top-level fields aren't lost
  if (rows.length === 0) {
    return [currentRow]
  }

  return rows
}

export function applyTemplateV2(html: string, template: V2ParsingTemplate, sourceUrl: string): FlatRow[] {
  // JSON-LD fast path
  if (template.useJsonLd) {
    const jsonLdEvents = extractJsonLd(html)
    if (jsonLdEvents.length > 0) {
      const fieldMap = template.jsonLdFieldMap || {}
      const defaultMap: Record<string, string> = {
        name: 'title',
        description: 'showDescription',
        startDate: 'date',
        url: 'ticketUrl'
      }
      const merged = { ...defaultMap, ...fieldMap }

      const rows: FlatRow[] = []
      for (const event of jsonLdEvents) {
        const row: FlatRow = {}
        for (const [jsonLdKey, csvField] of Object.entries(merged)) {
          let value: any = event
          for (const key of jsonLdKey.split('.')) {
            value = value?.[key]
          }
          if (value !== undefined && value !== null) {
            row[csvField] = String(value)
          }
        }
        // Handle location.name → venueName
        if ((event as any).location?.name && !row.venueName) {
          row.venueName = (event as any).location.name
        }
        // Handle image
        if ((event as any).image) {
          const img = (event as any).image
          row.showImageUrl = typeof img === 'string' ? img : img.url
        }
        // Handle offers
        const offers = Array.isArray((event as any).offers) ? (event as any).offers[0] : (event as any).offers
        if (offers?.url && !row.ticketUrl) row.ticketUrl = offers.url

        if (row.title && template.cleanup) {
          row.title = applyCleanupRules(row.title, template.cleanup)
        }
        if (row.title) rows.push(row)
      }
      if (rows.length > 0) return rows
    }
  }

  // CSS extraction via tree walking
  const $ = cheerio.load(html)
  return walkNodes(template.nodes, $.root(), $, sourceUrl, {})
}
