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
