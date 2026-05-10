import { ParsingTemplate } from './types'
import { V2ParsingTemplate, TemplateNode } from './v2Types'
import { ParsedEvent } from '../feedParser/shared'

const MAX_SAMPLES = 5
const MIN_SAMPLES_TO_FLAG = 3
const UNHEALTHY_THRESHOLD = 0.5

// Fields populated as a side-effect (presets, defaults from cleanup rules)
// shouldn't count toward the parser's "filled" tally. Only count fields the
// template actually targets.
function countV2TemplateFields(nodes: TemplateNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.type === 'field') {
      if (node.selector || node.staticValue !== undefined || node.presetValue !== undefined) {
        count++
      }
    } else if (node.type === 'container') {
      count += countV2TemplateFields(node.children)
    }
  }
  return count
}

function countV1TemplateFields(template: ParsingTemplate): number {
  let count = 0
  for (const rule of Object.values(template.selectors || {})) {
    if (rule?.selector) count++
  }
  if (template.cast?.containerSelector) count++
  if (template.crew?.containerSelector) count++
  return count
}

// V2 produces flat rows; count populated string keys per row.
function countV2RowFilled(row: Record<string, string | undefined>): number {
  let n = 0
  for (const v of Object.values(row)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') n++
  }
  return n
}

// V1 produces ParsedEvent objects with known optional fields.
function countV1EventFilled(event: ParsedEvent): number {
  let n = 0
  if (event.title) n++
  if (event.date) n++
  if (event.time) n++
  if (event.description || event.showDescription) n++
  if (event.ticketUrl) n++
  if (event.imageUrl) n++
  if (event.rawData?.venue) n++
  if (event.rawData?.price) n++
  if (event.runTitle) n++
  if (event.runDescription) n++
  if (event.duration) n++
  if (event.startDate) n++
  if (event.endDate) n++
  if (event.cast?.length) n++
  if (event.crew?.length) n++
  return n
}

interface FillRateInput {
  templateV1?: ParsingTemplate
  templateV2?: V2ParsingTemplate
  v1Events?: ParsedEvent[]
  v2Rows?: Array<Record<string, string | undefined>>
}

// Compute average fill rate across extracted items for this poll.
// Returns null if there's no meaningful signal (no items, or template has no fields).
export function computeFillRate(input: FillRateInput): number | null {
  let expected = 0
  let items: number[] = []

  if (input.templateV2 && input.v2Rows) {
    expected = countV2TemplateFields(input.templateV2.nodes)
    if (input.templateV2.useJsonLd) {
      // JSON-LD path doesn't use template selectors; skip health sampling.
      return null
    }
    items = input.v2Rows.map(row => countV2RowFilled(row))
  } else if (input.templateV1 && input.v1Events) {
    expected = countV1TemplateFields(input.templateV1)
    if (input.templateV1.useJsonLd) return null
    items = input.v1Events.map(e => countV1EventFilled(e))
  }

  if (expected === 0 || items.length === 0) return null

  const avgFilled = items.reduce((sum, n) => sum + n, 0) / items.length
  return Math.min(1, avgFilled / expected)
}

interface HealthUpdate {
  fillRateSamples: number[]
  healthStatus: 'healthy' | 'needs-attention'
  healthReason?: string
}

// Append a new sample to the rolling window and re-derive health.
export function recordFillRate(
  existingSamples: number[] | undefined,
  newSample: number
): HealthUpdate {
  const samples = [...(existingSamples || []), newSample].slice(-MAX_SAMPLES)

  if (samples.length < MIN_SAMPLES_TO_FLAG) {
    return { fillRateSamples: samples, healthStatus: 'healthy' }
  }

  const avg = samples.reduce((sum, n) => sum + n, 0) / samples.length
  if (avg < UNHEALTHY_THRESHOLD) {
    const pct = Math.round(avg * 100)
    return {
      fillRateSamples: samples,
      healthStatus: 'needs-attention',
      healthReason: `Only ${pct}% of template fields populating over last ${samples.length} polls — site may have changed`
    }
  }

  return { fillRateSamples: samples, healthStatus: 'healthy' }
}
