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
  /**
   * Regex patterns (string form) that mark a scraped title as junk — e.g. a
   * Cloudflare interstitial ("Please Wait", "Just a moment", "Attention
   * Required"). When the cleaned title matches any, the row is dropped rather
   * than staged. FB's crawler occasionally scrapes the challenge page instead
   * of the real one for Cloudflare-fronted sites (publictheater.org); this
   * keeps that garbage out of the review queue. Case-insensitive.
   */
  skipTitlePatterns?: string[]
}

const SEP = /\s*[|–—]\s*/ // pipe, en-dash, em-dash

// Always-applied junk-title guard. FB's crawler sometimes scrapes a
// Cloudflare/queue interstitial instead of the real page on guarded sites
// (e.g. publictheater.org behind Queue-it → "Please Wait / you've been placed
// in a queue"). This drops those universally, on top of any per-source
// skipTitlePatterns. Mirrors CHALLENGE_RE in discoverShowUrls. Case-insensitive.
const DEFAULT_SKIP_TITLE_RE =
  /just a moment|please wait|attention required|access denied|verify(?:ing)? you are (?:a )?human|you have been blocked|placed in (?:a )?queue|due to high demand/i

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

  // Drop Cloudflare/interstitial junk titles (FB sometimes scrapes the
  // challenge page instead of the real one on guarded sites). Built-in guard
  // first, then any per-source patterns.
  if (DEFAULT_SKIP_TITLE_RE.test(title)) return null
  for (const p of config.skipTitlePatterns ?? []) {
    try {
      if (new RegExp(p, 'i').test(title)) return null
    } catch {
      // invalid pattern — ignore
    }
  }

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
