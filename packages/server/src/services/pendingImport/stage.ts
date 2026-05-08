import { PendingImportModel } from '../../entities/pendingImport/pendingImportModel'
import type { CsvRowInput } from '../importEngine'

export interface StageOptions {
  dataSourceId: string
  dedupe?: boolean
}

export interface StageResult {
  staged: number
  skipped: number
}

function parseDate(s?: string): Date | undefined {
  if (!s) return undefined
  const d = new Date(s)
  return isNaN(d.getTime()) ? undefined : d
}

function parseDuration(s?: string): number | undefined {
  if (!s) return undefined
  const n = parseInt(s, 10)
  return isNaN(n) || n < 0 ? undefined : n
}

function parseTypes(s?: string): string[] | undefined {
  if (!s) return undefined
  const types = s.split(',').map(t => t.trim()).filter(Boolean)
  return types.length ? types : undefined
}

// Group rows by event so multiple person/credit rows for the same show land in
// one PendingImport with a populated cast/crew array (matching CSV import behavior).
function groupRowsByEvent(rows: CsvRowInput[]): CsvRowInput[][] {
  const groups = new Map<string, CsvRowInput[]>()
  for (const r of rows) {
    const key = `${r.title}|${r.date || ''}|${r.venueName || ''}|${r.runTitle || ''}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }
  return Array.from(groups.values())
}

export async function stageRowsAsPendingImports(
  rows: CsvRowInput[],
  opts: StageOptions
): Promise<StageResult> {
  const groups = groupRowsByEvent(rows)
  let staged = 0
  let skipped = 0

  for (const group of groups) {
    const head = group[0]
    if (!head?.title?.trim()) {
      skipped++
      continue
    }

    if (opts.dedupe !== false) {
      const date = parseDate(head.date)
      const titleTrim = head.title.trim()
      const venueTrim = head.venueName?.trim()

      // Cross-source dedup: per the data-overlap policy, multiple sources
      // reporting the same event is cross-validation, not a problem. If a
      // PendingImport with the same (title, date, venue) already exists in
      // ANY source, skip silently — first source wins. The match is
      // case-insensitive on title and venue so "BAM" and "Bam" don't
      // duplicate. Future work: merge complementary fields from the new
      // source onto the existing record.
      const titleRegex = new RegExp(
        `^${titleTrim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        'i'
      )
      const query: Record<string, unknown> = { title: titleRegex }
      if (date) query.date = date
      if (venueTrim) {
        query.venueName = new RegExp(
          `^${venueTrim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          'i'
        )
      }

      const existing = await PendingImportModel.findOne(query)
      if (existing) {
        skipped++
        continue
      }
    }

    const cast: { name: string; role?: string; headshotUrl?: string }[] = []
    const crew: { name: string; role?: string; headshotUrl?: string }[] = []
    for (const row of group) {
      if (!row.personName?.trim()) continue
      const entry = {
        name: row.personName.trim(),
        role: row.personRole?.trim() || undefined,
        headshotUrl: row.personHeadshotUrl?.trim() || undefined
      }
      const type = (row.creditType || '').toLowerCase().trim()
      if (type === 'crew') crew.push(entry)
      else cast.push(entry)
    }

    await new PendingImportModel({
      dataSource: opts.dataSourceId,
      status: 'pending',
      title: head.title.trim(),
      runTitle: head.runTitle?.trim() || undefined,
      showDescription: head.showDescription?.trim() || undefined,
      runDescription: head.runDescription?.trim() || undefined,
      performanceDescription: head.performanceDescription?.trim() || undefined,
      performanceTypes: parseTypes(head.performanceTypes),
      duration: parseDuration(head.duration),
      date: parseDate(head.date),
      time: head.time || head.startTime || undefined,
      venueName: head.venueName?.trim() || undefined,
      stageName: head.stageName?.trim() || undefined,
      companyName: head.companyName?.trim() || undefined,
      ticketUrl: head.ticketUrl?.trim() || undefined,
      imageUrl: head.performanceImageUrl || head.runImageUrl || head.showImageUrl || undefined,
      startDate: parseDate(head.runStartDate),
      endDate: parseDate(head.runEndDate),
      cast: cast.length ? cast : undefined,
      crew: crew.length ? crew : undefined,
      // Stash full CsvRowInput rows so a future approve flow can call processImportRows
      // directly instead of using the subset-fields path in promoteToRecords.
      rawData: { csvRows: group },
      importedAt: new Date()
    }).save()
    staged++
  }

  return { staged, skipped }
}
