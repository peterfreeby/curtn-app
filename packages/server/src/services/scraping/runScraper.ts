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
  defaults: Partial<CsvRowInput> = {},
  filters: { excludeUrlPatterns?: string[]; includeUrlPatterns?: string[] } = {}
): { rows: CsvRowInput[]; dropped: number; filtered: number } {
  let dropped = 0
  let filtered = 0
  const rows: CsvRowInput[] = []
  const exclude = filters.excludeUrlPatterns ?? []
  const include = filters.includeUrlPatterns ?? []
  for (const f of fragments) {
    const merged: Partial<CsvRowInput> = { ...defaults, ...f }
    if (!merged.title || !merged.title.trim()) {
      dropped++
      continue
    }
    const url = merged.ticketUrl ?? ''
    if (exclude.some(p => url.includes(p))) {
      filtered++
      continue
    }
    if (include.length > 0 && !include.some(p => url.includes(p))) {
      filtered++
      continue
    }
    rows.push(merged as CsvRowInput)
  }
  return { rows, dropped, filtered }
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

    const { rows, dropped, filtered } = mergeAndValidate(capped, config.rowDefaults, {
      excludeUrlPatterns: config.excludeUrlPatterns,
      includeUrlPatterns: config.includeUrlPatterns
    })
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
    if (filtered > 0) {
      console.log(`[runScraper] filtered out ${filtered} rows by URL patterns`)
    }

    // Multi-day run fan-out. For sources like BAM /theater that list each
    // production once with a date range ("Oct 22—Oct 26"), expand into one
    // row per day. The Run gets startDate / endDate from the original data;
    // each Performance lands on its own day.
    let fannedRows = rows
    if (config.fanOutByDateRange) {
      fannedRows = expandRowsByDateRange(rows)
      const added = fannedRows.length - rows.length
      if (added > 0) {
        console.log(`[runScraper] fan-out by date range: ${rows.length} → ${fannedRows.length} rows`)
      }
    }

    // Zero rows extracted counts as a soft failure — we may have been blocked
    // or the selector may have rotted. Track it for the circuit breaker.
    if (rows.length === 0) {
      extractionFailed = true
    }

    // Per-event detail enrichment. Each row's _detailUrl (or whatever the
    // config names) gets fetched, the detail template is applied, and fields
    // are merged. Detail templates can emit N rows per detail page (e.g., one
    // row per cast member) — those fan out into N rows sharing the listing's
    // event identity, which the staging helper groups into one PendingImport
    // with a cast/crew array. Per-row error tolerance: a single bad detail
    // page does not abort the run.
    let workingRows: CsvRowInput[] = fannedRows
    if (config.detail && fannedRows.length > 0) {
      const detailPage = await context.newPage()
      try {
        const { rows: enriched, stats: detailStats } = await runDetailFetches(
          detailPage, fannedRows, config.detail, config.startUrl
        )
        workingRows = enriched
        Object.assign(result, detailStats)
        result.rowsValid = enriched.length
      } finally {
        await detailPage.close()
      }
    } else {
      result.rowsValid = fannedRows.length
    }

    if (mode === 'dry-run') {
      result.rows = workingRows
    } else if (mode === 'direct') {
      result.importResult = await processImportRows(
        workingRows,
        { userId: opts.userId, dataSourceId: opts.dataSourceId },
        {}
      )
    } else {
      result.staging = await stageRowsAsPendingImports(workingRows, {
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

// For sources that list multi-day runs as a single card with start+end dates,
// expand each row into N rows (one per day). Each fanned row keeps the run's
// metadata; only `date` changes. Skipped when a row has no end date or the
// range is invalid; non-multi-day rows pass through unchanged.
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const MAX_FAN_OUT_DAYS = 60 // safety cap; nothing legit runs longer than ~2 months

function expandRowsByDateRange(rows: CsvRowInput[]): CsvRowInput[] {
  const out: CsvRowInput[] = []
  for (const row of rows) {
    const startStr = (row as any).runStartDate
    const endStr = (row as any).runEndDate
    if (!startStr || !endStr) {
      out.push(row)
      continue
    }
    const start = new Date(startStr)
    const end = new Date(endStr)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      out.push(row)
      continue
    }
    const days = Math.floor((end.getTime() - start.getTime()) / ONE_DAY_MS) + 1
    if (days <= 1 || days > MAX_FAN_OUT_DAYS) {
      out.push(row)
      continue
    }
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * ONE_DAY_MS)
      out.push({ ...row, date: d.toISOString() })
    }
  }
  return out
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

// For each listing row, follow its detail URL and merge extracted fields.
// Detail templates may emit multiple fragments per page (e.g., one per cast
// member). When that happens, we fan out into N output rows that share the
// listing's event identity — the staging helper groups them by (title, date)
// and rolls personName/personHeadshotUrl/personRole into a cast/crew array.
//
// Per-row try/catch protects 19 good rows from 1 bad detail page (timeout,
// 404, selector rot). Cache hits short-circuit the network entirely.
async function runDetailFetches(
  page: Page,
  rows: CsvRowInput[],
  detailConfig: DetailFetchConfig,
  startUrl: string
): Promise<{ rows: CsvRowInput[]; stats: DetailStats }> {
  const templateExtractor = detailConfig.template ? makeTemplateExtractor(detailConfig.template) : null
  const stats: DetailStats = { detailFetched: 0, detailCacheHits: 0, detailFailed: 0 }
  const out: CsvRowInput[] = []

  // Combined detail extraction: JSON-LD (for SPA/CMS sites with rich Event
  // schema), the CSS template, or both layered (template over the JSON-LD base).
  const extractDetail = async (detailUrl: string): Promise<Partial<CsvRowInput>[]> => {
    const ld = detailConfig.jsonLd ? await jsonLdExtractor.extract(page, detailUrl) : []
    const tpl = templateExtractor ? await templateExtractor.extract(page, detailUrl) : []
    if (ld.length && tpl.length) return tpl.map(t => ({ ...ld[0], ...t }))
    return ld.length ? ld : tpl
  }

  for (const row of rows) {
    const detailUrlRaw = (row as any)[detailConfig.fromField]
    if (!detailUrlRaw) {
      out.push(row)
      continue
    }
    const detailUrl = resolveDetailUrl(String(detailUrlRaw), startUrl)
    const fingerprint = computeFingerprint(row, detailConfig.fingerprint)

    let fragments: Partial<CsvRowInput>[] | null = null
    try {
      const cached = await readDetailCache(detailUrl, fingerprint, {
        maxAgeMs: detailConfig.cacheTtlMs
      })
      if (cached) {
        fragments = cached.fragments
        stats.detailCacheHits++
      } else {
        await politeNavigate(page, detailUrl, { useCache: false, hydrationDelayMs: 3_000 })
        fragments = await extractDetail(detailUrl)
        await writeDetailCache(detailUrl, fingerprint, fragments)
        stats.detailFetched++
      }
    } catch (err) {
      stats.detailFailed++
      console.warn(`[runScraper] detail fetch failed (${detailUrl}):`, (err as Error).message)
      out.push(row)
      continue
    }

    if (!fragments || fragments.length === 0) {
      out.push(row)
      continue
    }

    // Stamp creditType='cast' for any fragment carrying a personName but no
    // explicit credit. Detail templates often can't easily set static field
    // values, so the orchestrator does it.
    for (const f of fragments) {
      const fAny = f as any
      if (fAny.personName && !fAny.creditType) fAny.creditType = 'cast'
    }

    if (fragments.length === 1) {
      // Single-row detail: merge into listing row in place
      Object.assign(row, fragments[0])
      out.push(row)
    } else {
      // Multi-row detail: fan out — each fragment becomes a row with listing
      // fields as base. The staging helper will group them by (title, date)
      // and gather personName/personRole/personHeadshotUrl into a cast array.
      for (const f of fragments) {
        out.push({ ...row, ...f })
      }
    }
  }

  // Strip the internal detail-URL field before staging.
  for (const row of out) {
    delete (row as any)[detailConfig.fromField]
  }

  return { rows: out, stats }
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
