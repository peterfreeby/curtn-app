import type { Page } from 'playwright'
import type { CsvRowInput } from '../importEngine'

// Shared parsing template schema (Roadmap 0040). Stubbed here until that work lands;
// once the partner-facing template engine ships, swap this for the real import.
export interface ParsingTemplate {
  selectors?: Record<string, SelectorRule>
  listSelector?: string
  useJsonLd?: boolean
  jsonLdFieldMap?: Record<string, string>
  cleanup?: {
    stripPrefix?: string
    stripSuffix?: string
    titleCase?: boolean
  }
}

export interface SelectorRule {
  selector: string
  attribute?: string
  regex?: string
  transform?: 'date' | 'time' | 'datetime' | 'currency' | 'trim'
}

export type ExtractionStrategy =
  | { mode: 'json-ld' }
  | { mode: 'template'; template: ParsingTemplate }
  | { mode: 'code'; scraperId: string }

export interface ScraperDataSourceConfig {
  strategy: ExtractionStrategy
  startUrl: string
  rowDefaults?: Partial<CsvRowInput>
  waitFor?: string          // CSS selector to wait for before extracting
  maxItems?: number         // safety cap on rows per run
}

// An Extractor takes a rendered Playwright Page and produces row fragments.
// Row defaults and validation happen in the orchestrator, not in extractors.
export interface Extractor {
  extract(page: Page): Promise<Partial<CsvRowInput>[]>
}

// Tier 3: a code-only scraper module for sites that need bespoke logic.
export interface VenueScraper {
  id: string
  name: string
  startUrl: string
  defaultRow?: Partial<CsvRowInput>
  scrape(page: Page): Promise<Partial<CsvRowInput>[]>
}
