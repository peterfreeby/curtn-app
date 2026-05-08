import { chromium, type Browser } from 'playwright'
import { DataSourceModel } from '../../entities/dataSource/dataSourceModel'
import { processImportRows, type CsvRowInput, type ImportResult } from '../importEngine'
import { stageRowsAsPendingImports, type StageResult } from '../pendingImport/stage'
import { jsonLdExtractor } from './extractors/jsonLd'
import { getScraper } from './registry'
import type { ScraperDataSourceConfig, Extractor } from './types'

const USER_AGENT =
  'CurtnScraper/1.0 (+https://curtn.com; hello@curtn.com) Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const NAV_TIMEOUT_MS = 30_000
const DEFAULT_MAX_ITEMS = 500

export type RunMode = 'pending' | 'direct' | 'dry-run'

export interface RunScraperOptions {
  dataSourceId: string
  userId: string
  mode?: RunMode               // default: 'pending'
}

export interface RunScraperResult {
  rowsExtracted: number
  rowsValid: number
  mode: RunMode
  staging?: StageResult        // populated when mode === 'pending'
  importResult?: ImportResult  // populated when mode === 'direct'
  rows?: CsvRowInput[]         // populated when mode === 'dry-run'
}

function pickExtractor(config: ScraperDataSourceConfig): Extractor {
  switch (config.strategy.mode) {
    case 'json-ld':
      return jsonLdExtractor
    case 'template':
      throw new Error('Template extractor not implemented yet — Phase 2')
    case 'code': {
      const scraper = getScraper(config.strategy.scraperId)
      if (!scraper) throw new Error(`Unknown scraper id: ${config.strategy.scraperId}`)
      return { extract: (page) => scraper.scrape(page) }
    }
  }
}

function mergeAndValidate(
  fragments: Partial<CsvRowInput>[],
  defaults: Partial<CsvRowInput> = {}
): { rows: CsvRowInput[]; dropped: number } {
  let dropped = 0
  const rows: CsvRowInput[] = []
  for (const f of fragments) {
    const merged: Partial<CsvRowInput> = { ...defaults, ...f }
    if (!merged.title || !merged.title.trim()) {
      dropped++
      continue
    }
    rows.push(merged as CsvRowInput)
  }
  return { rows, dropped }
}

export async function runScraper(opts: RunScraperOptions): Promise<RunScraperResult> {
  const mode: RunMode = opts.mode ?? 'pending'

  const ds = await DataSourceModel.findById(opts.dataSourceId)
  if (!ds) throw new Error(`DataSource not found: ${opts.dataSourceId}`)
  if (ds.type !== 'scraper') throw new Error(`DataSource ${ds._id} is not type 'scraper' (got '${ds.type}')`)

  const config = ds.config as ScraperDataSourceConfig
  if (!config?.strategy || !config?.startUrl) {
    throw new Error(`DataSource ${ds._id} missing scraper config (strategy, startUrl)`)
  }

  const extractor = pickExtractor(config)

  let browser: Browser | undefined
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ userAgent: USER_AGENT })
    const page = await context.newPage()

    await page.goto(config.startUrl, {
      waitUntil: 'load',
      timeout: NAV_TIMEOUT_MS
    })
    if (config.waitFor) {
      await page.waitForSelector(config.waitFor, { timeout: NAV_TIMEOUT_MS })
    } else {
      // Default: brief wait for JS frameworks to hydrate
      await page.waitForTimeout(2000)
    }

    const fragments = await extractor.extract(page)
    const cap = config.maxItems ?? DEFAULT_MAX_ITEMS
    const capped = fragments.slice(0, cap)

    const { rows, dropped } = mergeAndValidate(capped, config.rowDefaults)
    const result: RunScraperResult = {
      rowsExtracted: fragments.length,
      rowsValid: rows.length,
      mode
    }

    if (dropped > 0) {
      console.warn(`[runScraper] dropped ${dropped} rows missing title`)
    }

    if (mode === 'dry-run') {
      result.rows = rows
    } else if (mode === 'direct') {
      result.importResult = await processImportRows(
        rows,
        { userId: opts.userId, dataSourceId: opts.dataSourceId },
        {}
      )
    } else {
      result.staging = await stageRowsAsPendingImports(rows, {
        dataSourceId: opts.dataSourceId
      })
    }

    if (mode !== 'dry-run') {
      ds.lastPolledAt = new Date()
      await ds.save()
    }

    return result
  } finally {
    if (browser) await browser.close()
  }
}
