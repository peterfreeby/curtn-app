import { fetchOpenGraph, OgFetchError } from './fetchOpenGraph'
import { mapOgToRow, type OgSourceConfig } from './mapOgToRow'
import { discoverShowUrls, type DiscoveryConfig } from './discoverShowUrls'
import { RateGovernor, type RateGovernorOptions } from './rateGovernor'
import { stageRowsAsPendingImports } from '../pendingImport/stage'
import type { CsvRowInput } from '../importEngine'

/**
 * Stored on DataSource.config when type==='api' and this is an OG-fallback
 * source. Extends the row-mapping config with how to find the show URLs.
 */
export interface OgFallbackConfig extends OgSourceConfig {
  kind: 'og-fallback'
  /** Harvest detail URLs from a reachable light page each run. */
  discovery?: DiscoveryConfig
  /** Or hardcode the URLs (used when even the light page is walled). */
  showUrls?: string[]
}

/** Minimal structural shape of the DataSource doc the runner needs. */
export interface OgFallbackSourceDoc {
  _id: { toString(): string }
  config: unknown
  fetchedUrls?: string[]
  lastPolledAt?: Date
  consecutiveFailures?: number
  save(): Promise<unknown>
}

export interface RunOgFallbackOptions {
  dryRun?: boolean
  /** Cap URLs processed this run (default: no cap — process everything new). */
  limit?: number
  /** Re-fetch URLs already in fetchedUrls (default false). */
  forceRefresh?: boolean
  /** Stage + persist fetchedUrls every N successful fetches, so an interrupted run resumes (default 10). */
  batchSize?: number
  /** Rate-governor tuning (thresholds, cooldown, max wait). */
  governor?: RateGovernorOptions
  onProgress?: (line: string) => void
}

export interface OgFallbackRunResult {
  discovered: number
  attempted: number
  parsed: number
  staged: number
  skipped: number
  failed: number
  /** True if we stopped before finishing because the FB budget stayed exhausted past the max wait. */
  stoppedEarly: boolean
}

const MAX_FETCHED_URLS = 5000

function isOgFallbackConfig(c: unknown): c is OgFallbackConfig {
  return !!c && typeof c === 'object' && (c as { kind?: string }).kind === 'og-fallback'
}

function fmtMs(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}min`
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * Fetch one URL through the governor: pace before each fresh attempt, and on a
 * throttle error cool down and retry the same URL until the governor's max-wait
 * budget is spent (then give up so the caller can stop and resume later).
 */
export async function fetchWithGovernor(
  url: string,
  governor: RateGovernor
): Promise<{ status: 'ok'; og: Awaited<ReturnType<typeof fetchOpenGraph>>['og'] } | { status: 'giveup' }> {
  let pace = true
  for (;;) {
    if (pace) await governor.awaitTurn()
    pace = true
    try {
      const { og, usage } = await fetchOpenGraph(url)
      governor.observe(usage)
      return { status: 'ok', og }
    } catch (e) {
      if (e instanceof OgFetchError && e.isRateLimit) {
        const retry = await governor.handleRateLimit(e.usage)
        if (!retry) return { status: 'giveup' }
        pace = false // handleRateLimit already cooled down; don't double-wait
        continue
      }
      throw e // non-throttle error — let the caller count it as failed
    }
  }
}

/**
 * Run an OG-fallback source to completion: discover show URLs, fetch each URL's
 * Open Graph stub via the FB Graph API (governed for the rolling-hour budget),
 * and stage them for review. Designed to run as long as it takes — when the FB
 * budget is exhausted it waits out the window and resumes, and it stages +
 * persists fetchedUrls in batches so an interrupted run picks up where it left
 * off. Mirrors runScraper's contract.
 *
 * LOCAL-only: discovery uses Playwright.
 */
export async function runOgFallbackSource(
  ds: OgFallbackSourceDoc,
  opts: RunOgFallbackOptions = {}
): Promise<OgFallbackRunResult> {
  const { dryRun = false, limit, forceRefresh = false, batchSize = 10, onProgress = () => {} } = opts

  const config = ds.config
  if (!isOgFallbackConfig(config)) {
    throw new Error(`DataSource ${ds._id.toString()} is not an og-fallback source (config.kind !== 'og-fallback')`)
  }

  const governor = new RateGovernor({
    ...opts.governor,
    onWait: ({ reason, ms, peakPct, cooldownSpentMs }) => {
      if (reason === 'cooldown' || reason === 'rate-limit-retry') {
        onProgress(`  ⏸ ${reason} — usage ${peakPct}%, waiting ${fmtMs(ms)} (cooldown spent ${fmtMs(cooldownSpentMs)})`)
      } else if (reason === 'graduated') {
        onProgress(`  … easing off — usage ${peakPct}%, ${fmtMs(ms)} between calls`)
      }
    }
  })

  // 1. Resolve candidate URLs, then drop already-fetched (unless forcing).
  const candidates = config.discovery ? await discoverShowUrls(config.discovery) : config.showUrls ?? []
  const discovered = candidates.length
  const fetched = new Set(ds.fetchedUrls ?? [])
  let toFetch = forceRefresh ? candidates : candidates.filter(u => !fetched.has(u))
  if (limit) toFetch = toFetch.slice(0, limit)

  onProgress(`discovered ${discovered}, ${toFetch.length} to fetch${dryRun ? '  [DRY RUN]' : ''}`)

  // 2. Fetch + stage in batches (incremental persistence for resumability).
  const rowsBatch: CsvRowInput[] = []
  const urlsBatch: string[] = []
  let attempted = 0
  let parsed = 0
  let failed = 0
  let staged = 0
  let skipped = 0
  let stoppedEarly = false

  const flush = async () => {
    if (!dryRun && rowsBatch.length) {
      const r = await stageRowsAsPendingImports(rowsBatch, { dataSourceId: ds._id.toString() })
      staged += r.staged
      skipped += r.skipped
    }
    if (!dryRun && urlsBatch.length) {
      const merged = [...(ds.fetchedUrls ?? []), ...urlsBatch]
      ds.fetchedUrls = merged.length > MAX_FETCHED_URLS ? merged.slice(-MAX_FETCHED_URLS) : merged
      await ds.save() // persist progress now — survives interruption
    }
    rowsBatch.length = 0
    urlsBatch.length = 0
  }

  for (const url of toFetch) {
    attempted++
    let res: Awaited<ReturnType<typeof fetchWithGovernor>>
    try {
      res = await fetchWithGovernor(url, governor)
    } catch (e) {
      failed++
      onProgress(`✗ ${url} — ${e instanceof Error ? e.message : String(e)}`)
      continue
    }

    if (res.status === 'giveup') {
      stoppedEarly = true
      attempted-- // didn't actually complete this one
      onProgress(`⏹ FB budget exhausted past max wait — stopping. Re-run to resume (progress saved).`)
      break
    }

    const row = mapOgToRow(res.og, config)
    if (!row) {
      failed++
      onProgress(`✗ ${url} — no usable og:title`)
      continue
    }

    parsed++
    rowsBatch.push(row)
    urlsBatch.push(url)
    onProgress(`✓ ${row.title}`)
    if (rowsBatch.length >= batchSize) await flush()
  }

  await flush()

  // 3. Final bookkeeping.
  if (!dryRun) {
    ds.lastPolledAt = new Date()
    ds.consecutiveFailures = parsed > 0 ? 0 : (ds.consecutiveFailures ?? 0) + 1
    await ds.save()
  }

  return { discovered, attempted, parsed, staged, skipped, failed, stoppedEarly }
}
