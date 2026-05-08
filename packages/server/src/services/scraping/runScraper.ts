import { chromium, type Browser, type Page } from 'playwright'
import { DataSourceModel } from '../../entities/dataSource/dataSourceModel'
import { processImportRows, type CsvRowInput, type ImportResult } from '../importEngine'
import { stageRowsAsPendingImports, type StageResult } from '../pendingImport/stage'
import { computeFingerprint, readDetailCache, writeDetailCache } from './detailCache'
import { jsonLdExtractor } from './extractors/jsonLd'
import { makeTemplateExtractor } from './extractors/template'
import { politeNavigate, RobotsBlockedError, USER_AGENT } from './politeNavigate'
import { getScraper } from './registry'
import type { DetailFetchConfig, ScraperDataSourceConfig, Extractor } from './types'

const NAV_TIMEOUT_MS = 30_000
const DEFAULT_MAX_ITEMS = 500
const DEFAULT_COOLDOWN_HOURS = 24
const FAILURE_THRESHOLD = 3 // disable source after this many consecutive failures

export type RunMode = 'pending' | 'direct' | 'dry-run'

export interface RunScraperOptions {
  dataSourceId: string
  userId: string
  mode?: RunMode               // default: 'pending'
  force?: boolean              // bypass cooldown + isActive guard
  useCache?: boolean           // default: false (production runs always refetch)
}

export interface RunScraperResult {
  rowsExtracted: number
  rowsValid: number
  mode: RunMode
  fromCache: boolean
  detailFetched: number        // detail pages newly fetched this run
  detailCacheHits: number      // detail pages served from cache
  detailFailed: number         // detail pages that errored (row keeps listing fields)
  staging?: StageResult        // populated when mode === 'pending'
  importResult?: ImportResult  // populated when mode === 'direct'
  rows?: CsvRowInput[]         // populated when mode === 'dry-run'
}

export class CooldownActiveError extends Error {
  constructor(public availableAt: Date) {
    super(`Source is in cooldown until ${availableAt.toISOString()}`)
    this.name = 'CooldownActiveError'
  }
}

export class SourceDisabledError extends Error {
  constructor(public reason: string) {
    super(`Source is disabled: ${reason}`)
    this.name = 'SourceDisabledError'
  }
}

function pickExtractor(config: ScraperDataSourceConfig): Extractor {
  switch (config.strategy.mode) {
    case 'json-ld':
      return jsonLdExtractor
    case 'template':
      return makeTemplateExtractor(config.strategy.template)
    case 'code': {
      const scraper = getScraper(config.strategy.scraperId)
      if (!scraper) throw new Error(`Unknown scraper id: ${config.strategy.scraperId}`)
      return { extract: (page, _url) => scraper.scrape(page) }
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
  const force = opts.force ?? false
  const useCache = opts.useCache ?? false

  const ds = await DataSourceModel.findById(opts.dataSourceId)
  if (!ds) throw new Error(`DataSource not found: ${opts.dataSourceId}`)
  if (ds.type !== 'scraper') throw new Error(`DataSource ${ds._id} is not type 'scraper' (got '${ds.type}')`)

  // Circuit breaker: refuse to run a disabled source unless forced
  if (!ds.isActive && !force) {
    throw new SourceDisabledError(ds.disabledReason || 'manually disabled')
  }

  // Cooldown: don't re-scrape too soon. Skip for dry-run since it's safe to test
  // extraction logic — actually dry-run still hits the network, so enforce.
  // Override with --force.
  if (!force && ds.lastPolledAt) {
    const cooldownHours = ds.cooldownHours ?? DEFAULT_COOLDOWN_HOURS
    const availableAt = new Date(ds.lastPolledAt.getTime() + cooldownHours * 3_600_000)
    if (availableAt > new Date()) {
      throw new CooldownActiveError(availableAt)
    }
  }

  const config = ds.config as ScraperDataSourceConfig
  if (!config?.strategy || !config?.startUrl) {
    throw new Error(`DataSource ${ds._id} missing scraper config (strategy, startUrl)`)
  }

  const extractor = pickExtractor(config)

  let browser: Browser | undefined
  let extractionFailed = false
  let extractionError: Error | undefined

  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ userAgent: USER_AGENT })
    const page = await context.newPage()

    let fromCache = false
    try {
      const nav = await politeNavigate(page, config.startUrl, {
        useCache,
        waitForSelector: config.waitFor,
        navTimeoutMs: NAV_TIMEOUT_MS
      })
      fromCache = nav.fromCache
    } catch (err) {
      if (err instanceof RobotsBlockedError) {
        // Robots block isn't a flaky-site failure — record it and disable the
        // source so we don't keep checking. Operator must override.
        await markDisabled(ds._id?.toString() || opts.dataSourceId, `robots.txt: ${err.reason}`)
        throw err
      }
      throw err
    }

    const fragments = await extractor.extract(page, config.startUrl)
    const cap = config.maxItems ?? DEFAULT_MAX_ITEMS
    const capped = fragments.slice(0, cap)

    const { rows, dropped } = mergeAndValidate(capped, config.rowDefaults)
    const result: RunScraperResult = {
      rowsExtracted: fragments.length,
      rowsValid: rows.length,
      mode,
      fromCache,
      detailFetched: 0,
      detailCacheHits: 0,
      detailFailed: 0
    }

    if (dropped > 0) {
      console.warn(`[runScraper] dropped ${dropped} rows missing title`)
    }

    // Zero rows extracted counts as a soft failure — we may have been blocked
    // or the selector may have rotted. Track it for the circuit breaker.
    if (rows.length === 0) {
      extractionFailed = true
    }

    // Per-event detail enrichment. Each row's _detailUrl (or whatever the
    // config names) gets fetched, the detail template is applied, and fields
    // are merged with detail-wins precedence. Per-row error tolerance: a
    // single bad detail page does not abort the run.
    if (config.detail && rows.length > 0) {
      const detailPage = await context.newPage()
      try {
        const detailStats = await runDetailFetches(detailPage, rows, config.detail, config.startUrl)
        Object.assign(result, detailStats)
      } finally {
        await detailPage.close()
      }
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

    return result
  } catch (err) {
    extractionFailed = true
    extractionError = err as Error
    throw err
  } finally {
    if (browser) await browser.close()
    if (mode !== 'dry-run') {
      await recordRunOutcome(
        opts.dataSourceId,
        extractionFailed ? 'failure' : 'success',
        extractionError?.message
      )
    }
  }
}

// Resolve a possibly-relative URL against the source's startUrl. Handles
// "/events/foo" → "https://caveat.nyc/events/foo" without breaking absolute URLs.
function resolveDetailUrl(maybeRelative: string, startUrl: string): string {
  try {
    return new URL(maybeRelative, startUrl).toString()
  } catch {
    return maybeRelative
  }
}

interface DetailStats {
  detailFetched: number
  detailCacheHits: number
  detailFailed: number
}

// For each row, follow its detail URL and merge extracted fields. Cache hits
// short-circuit the network. Per-row try/catch protects 19 good rows from 1
// bad detail page (timeout, 404, selector rot, etc.).
async function runDetailFetches(
  page: Page,
  rows: CsvRowInput[],
  detailConfig: DetailFetchConfig,
  startUrl: string
): Promise<DetailStats> {
  const detailExtractor = makeTemplateExtractor(detailConfig.template)
  const stats: DetailStats = { detailFetched: 0, detailCacheHits: 0, detailFailed: 0 }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as any
    const detailUrlRaw = row[detailConfig.fromField]
    if (!detailUrlRaw) continue
    const detailUrl = resolveDetailUrl(String(detailUrlRaw), startUrl)
    const fingerprint = computeFingerprint(row, detailConfig.fingerprint)

    try {
      const cached = await readDetailCache(detailUrl, fingerprint, {
        maxAgeMs: detailConfig.cacheTtlMs
      })
      if (cached) {
        Object.assign(row, cached.fields)
        stats.detailCacheHits++
        continue
      }

      await politeNavigate(page, detailUrl, { useCache: false, hydrationDelayMs: 3_000 })
      const fragments = await detailExtractor.extract(page, detailUrl)
      const detailFields = fragments[0] ?? {}
      Object.assign(row, detailFields)
      await writeDetailCache(detailUrl, fingerprint, detailFields)
      stats.detailFetched++
    } catch (err) {
      stats.detailFailed++
      console.warn(`[runScraper] detail fetch failed (${detailUrl}):`, (err as Error).message)
      // Continue with listing-only fields for this row
    }
  }

  // Strip the internal detail-URL field before staging. processImportRows
  // shouldn't see implementation details of the scraper.
  for (const row of rows) {
    delete (row as any)[detailConfig.fromField]
  }

  return stats
}

async function recordRunOutcome(
  dataSourceId: string,
  outcome: 'success' | 'failure',
  errorMessage?: string
): Promise<void> {
  const ds = await DataSourceModel.findById(dataSourceId)
  if (!ds) return

  ds.lastPolledAt = new Date()
  if (outcome === 'success') {
    ds.consecutiveFailures = 0
    ds.lastSuccessAt = new Date()
  } else {
    ds.consecutiveFailures = (ds.consecutiveFailures ?? 0) + 1
    if (ds.consecutiveFailures >= FAILURE_THRESHOLD && ds.isActive) {
      ds.isActive = false
      ds.disabledReason = `auto-disabled after ${ds.consecutiveFailures} consecutive failures${errorMessage ? `: ${errorMessage.slice(0, 200)}` : ''}`
      console.warn(`[runScraper] auto-disabled DataSource ${dataSourceId}: ${ds.disabledReason}`)
    }
  }
  await ds.save()
}

async function markDisabled(dataSourceId: string, reason: string): Promise<void> {
  const ds = await DataSourceModel.findById(dataSourceId)
  if (!ds) return
  ds.isActive = false
  ds.disabledReason = reason
  await ds.save()
}
