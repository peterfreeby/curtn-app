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
}

// Optional second-pass extraction: after the listing template produces rows,
// the orchestrator can follow a per-row URL and merge fields from the detail
// page (e.g., full descriptions, additional images, cast). Detail fields take
// precedence over listing fields on conflict.
export interface DetailFetchConfig {
  fromField: string                 // listing template captures the URL into this field
  template: AnyParsingTemplate      // applied to the detail page response
  cacheTtlMs?: number               // default: 7 days
  fingerprint?: string[]            // listing fields hashed into the cache key (default: ['title', 'date'])
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
