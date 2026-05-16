// Shared heuristics for deciding whether a Run has a variable lineup
// (recurring showcase / comedy night / rotating bill) vs. a fixed cast
// (a normal play). Used by both import paths — reviewPendingImport.ts
// (scraper / PendingImport) and processImportRows.ts (CSV) — so they stay
// consistent. See [[Per-Performance Cast Attribution]] and
// [[Venue Default Performance Type]].

// Performance-type prior: these formats almost always run a different
// lineup each night, so cast belongs to the Performance, not the Run.
// Everything else (theater, play, musical, opera, dance, music, immersive,
// experimental, other) defaults to fixed-cast — the Run's credits are the
// shared cast every performance inherits.
const VARIABLE_LINEUP_TYPES = new Set([
  'comedy',
  'improv',
  'cabaret',
  'burlesque',
  'drag',
  'spoken-word',
  'happening'
])

/**
 * The supporting prior (Peter, 2026-05-16): performance type — strengthened
 * by the venue's default performance type — gives a strong initial guess at
 * whether a run is variable-lineup, used before the zero-overlap signal has
 * any data (i.e. on the first performance of a run).
 */
export function typeImpliesVariableLineup(
  performanceTypes: string[] | undefined,
  venueDefaultType: string | undefined
): boolean {
  const types = (performanceTypes && performanceTypes.length
    ? performanceTypes
    : venueDefaultType
      ? [venueDefaultType]
      : []
  ).map(t => t.toLowerCase().trim())
  return types.some(t => VARIABLE_LINEUP_TYPES.has(t))
}

/**
 * Resolve the performance types to persist on a Show: the event's own types
 * if it has any, otherwise fall back to the venue's default. Never overrides
 * an explicitly-typed event.
 */
export function resolvePerformanceTypes(
  eventTypes: string[] | undefined,
  venueDefaultType: string | undefined
): string[] {
  if (eventTypes && eventTypes.length) return eventTypes
  if (venueDefaultType) return [venueDefaultType]
  return []
}

/**
 * The primary discriminator (Peter, 2026-05-16): if the incoming cast shares
 * (near-)zero people with the cast a run has already accumulated, the run is
 * variable-lineup. Partial overlap = same production with substitutions
 * (understudy / swing) — that stays fixed-cast and is handled by the existing
 * creditOverrides add/remove machinery, NOT by flipping the flag. Only a
 * clean break in personnel flips it.
 *
 * @param incoming  person identifiers (slugs or ids) in the event being imported
 * @param accumulated person identifiers already credited at the run level
 * @returns true when there's a clean personnel break (zero/near-zero overlap)
 */
export function isCleanLineupBreak(
  incoming: Set<string>,
  accumulated: Set<string>
): boolean {
  // Need a real prior cast to compare against, and a real incoming cast.
  if (accumulated.size === 0 || incoming.size === 0) return false
  let shared = 0
  for (const p of incoming) if (accumulated.has(p)) shared++
  // "near-zero" — tolerate a single shared name (a host/MC who recurs across
  // an otherwise different lineup shouldn't peg it as fixed-cast).
  const overlapRatio = shared / Math.min(incoming.size, accumulated.size)
  return shared <= 1 && overlapRatio < 0.2
}
