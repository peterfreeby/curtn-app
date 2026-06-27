import type { Page } from 'playwright'
import type { CsvRowInput } from '../importEngine'
import type { ParsingTemplate } from '../pageFetcher'
import type { V2ParsingTemplate } from '../pageFetcher/v2Types'

export type AnyParsingTemplate = ParsingTemplate | V2ParsingTemplate

export type ExtractionStrategy =
  | { mode: 'json-ld' }
  | { mode: 'template'; template: AnyParsingTemplate }
  | { mode: 'code'; scraperId: string }

export interface ScraperDataSourceConfig {
  strategy: ExtractionStrategy
  startUrl: string
  rowDefaults?: Partial<CsvRowInput>
  waitFor?: string
  maxItems?: number
  detail?: DetailFetchConfig
  // Drop any extracted row whose ticketUrl contains one of these substrings.
  // Useful for source-level category exclusion (e.g., BAM lumps film, music,
  // theater all on the same calendar page; we only want performing arts).
  excludeUrlPatterns?: string[]
  // Inverse of excludeUrlPatterns. When set, only rows whose ticketUrl
  // contains at least one of these substrings pass through.
  includeUrlPatterns?: string[]
  // For sources that list multi-day runs without per-day rows (BAM theater /
  // dance). When true, any row with both runStartDate and runEndDate gets
  // expanded into one row per day in the range. Each fanned row keeps the
  // run's metadata but its `date` is set to the specific day. Time stays
  // empty — admin can fill in if needed, or the data flows through to a
  // Performance with no time (Performance.time is optional).
  fanOutByDateRange?: boolean
  // Download scraped images into our own R2 bucket instead of hotlinking the
  // source. Set for venues that hotlink-protect their images (the URL renders
  // broken cross-origin on Curtn — e.g. St. Ann's Warehouse). A failed rehost
  // drops the image rather than persisting a broken link. Off by default.
  rehostImages?: boolean
  // Post-extraction text cleanup, applied to each final row just before
  // staging. Each pattern is a regex (string form) stripped from the field;
  // a description reduced to empty becomes undefined. Use to peel promo
  // prefixes off titles ("JUST ADDED:") or boilerplate off descriptions.
  cleanup?: {
    titleStripPatterns?: string[]
    descriptionStripPatterns?: string[]
  }
}

// Optional second-pass extraction: after the listing template produces rows,
// the orchestrator can follow a per-row URL and merge fields from the detail
// page (e.g., full descriptions, additional images, cast). Detail fields take
// precedence over listing fields on conflict.
export interface DetailFetchConfig {
  fromField: string                 // listing template captures the URL into this field
  template?: AnyParsingTemplate     // CSS template applied to the detail page (optional if jsonLd)
  jsonLd?: boolean                  // extract the detail page's schema.org Event JSON-LD into fields
                                    //   (for SPA/CMS sites whose detail pages carry rich JSON-LD but
                                    //   inconsistent DOM). When both are set, template fragments are
                                    //   layered over the JSON-LD base (template wins on conflict).
  cacheTtlMs?: number               // default: 7 days
  fingerprint?: string[]            // listing fields hashed into the cache key (default: ['title', 'date'])
  // csvFields that merge from the detail page ONLY when the listing row's
  // value is empty (gap-fill, not override). Other detail fields override the
  // listing as usual. Use for JSON-LD sources that occasionally drop a field
  // (e.g. image) on a single event while the listing has it.
  fillIfEmpty?: string[]
  // JS-hydrated detail pages: wait until this selector is present AND non-empty
  // (its text OR data-full attribute) before extracting, instead of the fixed
  // hydration delay. Falls back to whatever's in the DOM if it never populates.
  waitForSelector?: string
  // Create a fresh browser context (+page) per detail fetch instead of reusing
  // one page for the batch. Avoids anti-bot/session degradation on sites that
  // 403 or stop hydrating on the 2nd+ sequential request (Cloudflare, etc.).
  // Heavier (new context per row) — only enable where reuse is demonstrably
  // broken. Default: false (reuse one page, as today).
  freshContextPerFetch?: boolean
}

export interface Extractor {
  extract(page: Page, sourceUrl: string): Promise<Partial<CsvRowInput>[]>
}

export interface VenueScraper {
  id: string
  name: string
  startUrl: string
  defaultRow?: Partial<CsvRowInput>
  scrape(page: Page): Promise<Partial<CsvRowInput>[]>
}
