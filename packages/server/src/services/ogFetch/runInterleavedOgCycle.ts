import { DataSourceModel } from '../../entities/dataSource/dataSourceModel'
import { stageRowsAsPendingImports } from '../pendingImport/stage'
import type { CsvRowInput } from '../importEngine'
import { discoverShowUrls } from './discoverShowUrls'
import { mapOgToRow } from './mapOgToRow'
import { RateGovernor, type RateGovernorOptions } from './rateGovernor'
import { fetchWithGovernor, type OgFallbackConfig } from './runOgFallbackSource'

// ===========================================================================
// Interleaved ("deal-cards") OG-fallback cycle.
//
// v1 (ogFallbackCycle.ts → runOgFallbackSource) ran each source to completion:
// discover ALL its URLs, then FB-fetch ALL of them, then the next source. One
// slow or hung source starved everything after it (the freeze on The Public
// Theater), and progress arrived one whole venue at a time.
//
// This scheduler decomposes the pipeline into three phases so fetch jobs from
// ALL sources share one rotation, served round-robin across sources:
//   1. Discover (per source, sequential): one Playwright hit per venue to
//      harvest detail URLs. Time-boxed so a walled homepage can't hang the run.
//   2. Fetch (ONE interleaved rotation): pop one URL per source in turn and
//      fetch its OG stub via the FB Graph API through a SINGLE shared governor
//      (the FB rolling-hour budget is app-global — one instance is mandatory).
//   3. Stage (per source): stage the source's rows, persist bookkeeping.
//
// NOTE on traffic: unlike the scraper, round-robin here does NOT shape venue
// traffic — the heavy fetch loop hits graph.facebook.com (Facebook fetches the
// venue on our behalf), and our only venue-facing request is the single Phase-1
// discovery load. The rotation buys interleaved progress + resilience: a hung
// or exhausted source no longer blocks the others.
// ===========================================================================

const MAX_FETCHED_URLS = 5000

export interface InterleavedOgCycleOptions {
  dryRun?: boolean
  /** Re-fetch URLs already in fetchedUrls (re-scrape the season). */
  force?: boolean
  /** Cap on number of SOURCES processed (debugging). */
  limit?: number
  /** Stage + persist fetchedUrls every N successful fetches per source (default 10). */
  batchSize?: number
  /** Pacing between Phase-1 discovery loads (venue-facing, one each) (default 1500ms). */
  discoveryDelayMs?: number
  /** Hard backstop on a single discovery (Playwright already self-limits ~85s) (default 120000ms). */
  discoveryTimeoutMs?: number
  /** FB rate-governor tuning (shared across all sources). */
  governor?: RateGovernorOptions
  onLog?: (line: string) => void
}

export interface OgCycleRowResult {
  name: string
  status: 'staged' | 'no-new' | 'partial' | 'error'
  discovered?: number
  staged?: number
  skipped?: number
  failed?: number
  detail?: string
}

interface SourceState {
  ds: any // hydrated DataSource doc (mutated + saved)
  name: string
  config: OgFallbackConfig
  toFetch: string[]
  cursor: number
  rowsBatch: CsvRowInput[]
  urlsBatch: string[]
  discovered: number
  parsed: number
  staged: number
  skipped: number
  failed: number
  status: OgCycleRowResult['status']
  detail?: string
}

function isOgFallbackConfig(c: unknown): c is OgFallbackConfig {
  return !!c && typeof c === 'object' && (c as { kind?: string }).kind === 'og-fallback'
}

const TIMED_OUT = Symbol('timed-out')
async function raceTimeout<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let t: ReturnType<typeof setTimeout>
  const to = new Promise<typeof TIMED_OUT>(r => { t = setTimeout(() => r(TIMED_OUT), ms) })
  try {
    return await Promise.race([p, to])
  } finally {
    clearTimeout(t!)
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function runInterleavedOgCycle(
  opts: InterleavedOgCycleOptions = {}
): Promise<OgCycleRowResult[]> {
  const {
    dryRun = false,
    force = false,
    limit,
    batchSize = 10,
    discoveryDelayMs = 1500,
    discoveryTimeoutMs = 120_000,
    onLog = (l: string) => console.log(l),
  } = opts

  // Hydrated docs (not .lean()) — we mutate + save each source.
  const sources = await DataSourceModel.find({
    type: 'api',
    'config.kind': 'og-fallback',
    isActive: true,
  }).sort({ lastPolledAt: 1 }) // nulls (never polled) sort first

  const queue = limit ? sources.slice(0, limit) : sources
  const results: OgCycleRowResult[] = []
  const states: SourceState[] = []

  onLog(`\n=== Interleaved OG cycle: ${queue.length} active source(s) ===`)
  onLog(`Mode: ${dryRun ? 'dry-run' : 'pending (stages to /admin/incoming)'}${force ? ' | force (re-fetch all URLs)' : ''}\n`)

  // ---- Phase 1: discover (per source, time-boxed) ----
  for (let i = 0; i < queue.length; i++) {
    const ds = queue[i]
    const config = ds.config
    if (!isOgFallbackConfig(config)) {
      results.push({ name: ds.name, status: 'error', detail: "config.kind !== 'og-fallback'" })
      continue
    }

    let candidates: string[] = []
    try {
      if (config.discovery) {
        const r = await raceTimeout(discoverShowUrls(config.discovery), discoveryTimeoutMs)
        if (r === TIMED_OUT) {
          results.push({ name: ds.name, status: 'error', detail: `discovery timed out (${discoveryTimeoutMs}ms)` })
          onLog(`  discover ${ds.name} — ⏱ timed out (skipped)`)
          continue
        }
        candidates = r
      } else {
        candidates = config.showUrls ?? []
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ name: ds.name, status: 'error', detail: msg.slice(0, 160) })
      onLog(`  discover ${ds.name} — ✗ ${msg.slice(0, 120)}`)
      continue
    }

    const fetched = new Set<string>(ds.fetchedUrls ?? [])
    const toFetch = force ? candidates : candidates.filter(u => !fetched.has(u))

    states.push({
      ds, name: ds.name, config,
      toFetch, cursor: 0,
      rowsBatch: [], urlsBatch: [],
      discovered: candidates.length,
      parsed: 0, staged: 0, skipped: 0, failed: 0,
      status: toFetch.length === 0 ? 'no-new' : 'staged',
    })
    onLog(`  discover ${ds.name} — ${candidates.length} found, ${toFetch.length} to fetch`)

    if (i < queue.length - 1 && discoveryDelayMs > 0) await sleep(discoveryDelayMs)
  }

  // ---- Phase 2: interleaved fetch (round-robin across sources, ONE governor) ----
  const governor = new RateGovernor({
    ...opts.governor,
    onWait: ({ reason, ms, peakPct, cooldownSpentMs }) => {
      if (reason === 'cooldown' || reason === 'rate-limit-retry') {
        onLog(`  ⏸ ${reason} — usage ${peakPct}%, waiting ${(ms / 1000).toFixed(0)}s (cooldown spent ${(cooldownSpentMs / 1000).toFixed(0)}s)`)
      }
    },
  })

  const totalJobs = states.reduce((n, s) => n + s.toFetch.length, 0)
  let done = 0
  let stoppedEarly = false

  const flush = async (s: SourceState) => {
    if (!dryRun && s.rowsBatch.length) {
      const r = await stageRowsAsPendingImports(s.rowsBatch, { dataSourceId: s.ds._id.toString() })
      s.staged += r.staged
      s.skipped += r.skipped
    }
    if (!dryRun && s.urlsBatch.length) {
      const merged = [...(s.ds.fetchedUrls ?? []), ...s.urlsBatch]
      s.ds.fetchedUrls = merged.length > MAX_FETCHED_URLS ? merged.slice(-MAX_FETCHED_URLS) : merged
      await s.ds.save() // persist progress now — survives interruption
    }
    s.rowsBatch.length = 0
    s.urlsBatch.length = 0
  }

  if (totalJobs > 0) {
    onLog(`\n  fetch    ${totalJobs} URL(s) across ${states.filter(s => s.toFetch.length).length} source(s) — interleaving round-robin`)
  }

  // Round-robin: one URL per source per pass, until every source is drained.
  while (!stoppedEarly) {
    let didWork = false
    for (const s of states) {
      if (s.cursor >= s.toFetch.length) continue
      const url = s.toFetch[s.cursor++]
      didWork = true

      let res: Awaited<ReturnType<typeof fetchWithGovernor>>
      try {
        res = await fetchWithGovernor(url, governor)
      } catch (err) {
        s.failed++
        onLog(`  fetch ✗  ${s.name}: ${(err instanceof Error ? err.message : String(err)).slice(0, 100)}`)
        continue
      }

      if (res.status === 'giveup') {
        // FB budget exhausted past max wait — stop the whole cycle; the URL
        // wasn't consumed, so rewind the cursor so a re-run retries it.
        s.cursor--
        stoppedEarly = true
        onLog(`  ⏹ FB budget exhausted past max wait — stopping. Re-run to resume (progress saved).`)
        break
      }

      const row = mapOgToRow(res.og, s.config)
      if (!row) {
        s.failed++
        continue
      }
      s.parsed++
      s.rowsBatch.push(row)
      s.urlsBatch.push(url)
      done++
      onLog(`  fetch ✓  ${s.name}: ${row.title}`)
      if (s.rowsBatch.length >= batchSize) await flush(s)
      if (done % 25 === 0) onLog(`  fetch    ${done}/${totalJobs} done`)
    }
    if (!didWork) break // all sources drained
  }

  // ---- Phase 3: final flush + bookkeeping (per source) ----
  for (const s of states) {
    await flush(s)
    if (!dryRun) {
      s.ds.lastPolledAt = new Date()
      s.ds.consecutiveFailures = s.parsed > 0 ? 0 : (s.ds.consecutiveFailures ?? 0) + 1
      await s.ds.save()
    }

    const remaining = s.toFetch.length - s.cursor
    const status: OgCycleRowResult['status'] =
      s.toFetch.length === 0 ? 'no-new' : (stoppedEarly && remaining > 0) ? 'partial' : 'staged'
    s.status = status
    results.push({
      name: s.name, status,
      discovered: s.discovered, staged: s.staged, skipped: s.skipped, failed: s.failed,
      detail: `parsed ${s.parsed}, failed ${s.failed}${remaining > 0 ? `, ${remaining} left` : ''}`,
    })
    onLog(`  stage    ${s.name} — parsed ${s.parsed} → staged ${s.staged}, skipped ${s.skipped}, failed ${s.failed}${remaining > 0 ? ` (${remaining} left — re-run)` : ''}`)
  }

  return results
}
