// Range-aware date parsing for listings like "April 21–June 14, 2026", where a
// single trailing year applies to BOTH ends. Backs the date-range-start /
// date-range-end transforms.
//
// Why it exists: the plain `date` transform infers the current year for
// year-less dates and rolls forward to next year if >30 days in the past. That's
// right for upcoming single events but wrong for a run's START date — a show
// legitimately mid-run has a start in the recent past, and roll-forward turns it
// into next year (producing an invalid start-after-end run). Range parsing reads
// the shared trailing year so neither end needs inference.

const RANGE_SEP = /\s*[–—‒−]\s*|\s+-\s+|\s+to\s+/i // en/em/figure dash, minus, " - ", " to "
const YEAR_RE = /\b(?:19|20)\d{2}\b/

function yearOf(s: string): number | undefined {
  const m = s.match(YEAR_RE)
  return m ? parseInt(m[0], 10) : undefined
}

function parsePart(part: string, fallbackYear?: number): Date | undefined {
  const hasYear = YEAR_RE.test(part)
  const str = hasYear ? part : fallbackYear != null ? `${part} ${fallbackYear}` : part
  const d = new Date(str)
  if (isNaN(d.getTime())) return undefined
  // No year anywhere — assume current year (no roll-forward; run dates can be past).
  if (!hasYear && fallbackYear == null) d.setFullYear(new Date().getFullYear())
  return d
}

/**
 * Parse one end of a date range. Handles:
 *   - "April 21–June 14, 2026"        → trailing year applies to both ends
 *   - "Oct 22—Oct 26, 2025"           → same
 *   - "Dec 30 – Jan 4, 2026"          → start rolls to prior year (cross-boundary)
 *   - "December 30, 2025 – Jan 4, 2026" → each end carries its own year
 *   - "April 21, 2026" (single date)  → start === end
 * Returns undefined when the text can't be parsed.
 */
export function parseDateRange(value: string, which: 'start' | 'end'): Date | undefined {
  const text = (value || '').trim()
  if (!text) return undefined

  const parts = text.split(RANGE_SEP).map(p => p.trim()).filter(Boolean)
  if (parts.length < 2) {
    return parsePart(text, yearOf(text)) // single date — both ends equal
  }

  const startPart = parts[0]
  const endPart = parts[parts.length - 1]
  const sharedYear = yearOf(startPart) ?? yearOf(endPart)

  let start = parsePart(startPart, yearOf(startPart) ?? sharedYear)
  const end = parsePart(endPart, yearOf(endPart) ?? sharedYear)

  // Cross-year-boundary ("Dec 30 – Jan 4, 2026"): if start lands after end, the
  // start belongs to the previous year.
  if (start && end && start.getTime() > end.getTime()) {
    start = new Date(start)
    start.setFullYear(start.getFullYear() - 1)
  }

  return which === 'start' ? start : end
}
