import type { Page } from 'playwright'
import type { CsvRowInput } from '../../importEngine'
import { applyTemplate, applyTemplateV2 } from '../../pageFetcher'
import { isV2Template } from '../../pageFetcher/v2Types'
import type { ParsedEvent } from '../../feedParser/shared'
import type { Extractor, AnyParsingTemplate } from '../types'

function dateToIso(d?: Date): string | undefined {
  if (!d) return undefined
  if (!(d instanceof Date) || isNaN(d.getTime())) return undefined
  return d.toISOString().split('T')[0]
}

// V1 templates produce ParsedEvent[] (feed shape). Map to CsvRowInput rows so the
// orchestrator's downstream pipeline (validation, defaults, staging) is uniform.
function parsedEventToRows(event: ParsedEvent): Partial<CsvRowInput>[] {
  const base: Partial<CsvRowInput> = {
    title: event.title,
    showDescription: event.showDescription || event.description,
    runTitle: event.runTitle,
    runDescription: event.runDescription,
    duration: event.duration !== undefined ? String(event.duration) : undefined,
    date: dateToIso(event.date),
    time: event.time,
    ticketUrl: event.ticketUrl,
    performanceImageUrl: event.imageUrl,
    runStartDate: dateToIso(event.startDate),
    runEndDate: dateToIso(event.endDate)
  }

  const cast = event.cast ?? []
  const crew = event.crew ?? []
  if (cast.length === 0 && crew.length === 0) {
    return [base]
  }

  const rows: Partial<CsvRowInput>[] = []
  for (const c of cast) {
    rows.push({
      ...base,
      personName: c.name,
      personRole: c.role,
      personHeadshotUrl: c.headshotUrl,
      creditType: 'cast'
    })
  }
  for (const c of crew) {
    rows.push({
      ...base,
      personName: c.name,
      personRole: c.role,
      personHeadshotUrl: c.headshotUrl,
      creditType: 'crew'
    })
  }
  return rows
}

export function makeTemplateExtractor(template: AnyParsingTemplate): Extractor {
  return {
    async extract(page, sourceUrl) {
      const html = await page.content()

      if (isV2Template(template)) {
        // V2 produces flat rows already shaped like CsvRowInput.
        const flatRows = applyTemplateV2(html, template, sourceUrl)
        return flatRows as Partial<CsvRowInput>[]
      }

      const events = applyTemplate(html, template, sourceUrl)
      return events.flatMap(parsedEventToRows)
    }
  }
}
