import type { CsvRowInput } from '../importEngine'
import type { OpenGraphResult } from './types'

/**
 * Per-venue config for turning an OG stub into a stageable row. The venue
 * fields come from the source (not the page) since OG never carries address /
 * room / genre.
 */
export interface OgSourceConfig {
  venueName: string
  performanceTypes?: string
  venueAddress?: string
  venueCity?: string
  venueState?: string
  venueZipCode?: string
  /**
   * Suffixes to strip from og:title, e.g. ' | The Public Theater'. Applied
   * before the generic "| venueName" trailing-segment strip.
   */
  titleSuffixes?: string[]
  /**
   * Regex patterns (string form) stripped in sequence from og:description.
   * FB-generated OG descriptions dump page text (credits, date range, image
   * filename, CTA buttons) ahead of the real synopsis; these peel that off.
   * A description reduced to empty becomes undefined.
   */
  descriptionStripPatterns?: string[]
}

const SEP = /\s*[|–—]\s*/ // pipe, en-dash, em-dash

/**
 * og:title often carries a site-name suffix ("GIRL, INTERRUPTED | The Public
 * Theater"). Strip configured suffixes, then drop a trailing "| <segment>"
 * when that segment looks like the venue/site name. Casing is left as-is —
 * the Public returns ALL-CAPS titles, but auto-title-casing risks mangling
 * stylized names, and a human reviews every stub at /admin/incoming anyway.
 */
export function cleanTitle(rawTitle: string, config: OgSourceConfig): string {
  let t = rawTitle.trim()
  for (const suffix of config.titleSuffixes ?? []) {
    if (t.toLowerCase().endsWith(suffix.toLowerCase())) {
      t = t.slice(0, t.length - suffix.length).replace(/\s*[|–—-]\s*$/, '').trim()
    }
  }
  const segments = t.split(SEP)
  if (segments.length > 1) {
    const last = segments[segments.length - 1].toLowerCase()
    const venueWords = config.venueName.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const looksLikeVenue = venueWords.some(w => last.includes(w))
    if (looksLikeVenue) t = segments.slice(0, -1).join(' | ').trim()
  }
  return t
}

/**
 * Strip configured boilerplate patterns from an OG description in sequence.
 * Returns undefined when nothing usable remains.
 */
export function cleanDescription(raw: string | undefined, config: OgSourceConfig): string | undefined {
  if (!raw) return undefined
  let d = raw
  for (const p of config.descriptionStripPatterns ?? []) {
    try {
      d = d.replace(new RegExp(p), '')
    } catch {
      // invalid pattern — leave as-is
    }
  }
  d = d.trim()
  return d || undefined
}

/**
 * Map an OG stub to a single CsvRowInput. Yields title + description + poster
 * + the source URL (as both showUrl and ticketUrl); venue fields come from
 * config. No date/time/cast — that's the known stub limitation (rung 4).
 * Returns null when there's no usable title.
 */
export function mapOgToRow(og: OpenGraphResult, config: OgSourceConfig): CsvRowInput | null {
  const title = og.title ? cleanTitle(og.title, config) : ''
  if (!title) return null

  return {
    title,
    showDescription: cleanDescription(og.description, config),
    showImageUrl: og.imageUrl,
    showUrl: og.url,
    ticketUrl: og.url,
    venueName: config.venueName,
    performanceTypes: config.performanceTypes,
    venueAddress: config.venueAddress,
    venueCity: config.venueCity,
    venueState: config.venueState,
    venueZipCode: config.venueZipCode
  }
}
