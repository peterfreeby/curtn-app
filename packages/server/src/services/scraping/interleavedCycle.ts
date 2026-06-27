import { chromium, type Browser } from 'playwright'
import { DataSourceModel } from '../../entities/dataSource/dataSourceModel'
import type { CsvRowInput } from '../importEngine'
import { stageRowsAsPendingImports } from '../pendingImport/stage'
import { computeFingerprint, readDetailCache, writeDetailCache } from './detailCache'
import { jsonLdExtractor } from './extractors/jsonLd'
import { makeTemplateExtractor } from './extractors/template'
import { politeNavigate, RobotsBlockedError, USER_AGENT } from './politeNavigate'
import { rehostRowImages } from '../images/rehostImage'
import {
  pickExtractor,
  mergeAndValidate,
  mergeFragment,
  applyRowCleanup,
  expandRowsByDateRange,
  resolveDetailUrl,
  recordRunOutcome,
  markDisabled,
  NAV_TIMEOUT_MS,
  DEFAULT_MAX_ITEMS,
  DEFAULT_COOLDOWN_HOURS,
} from './runScraper'
import type { DetailFetchConfig, ScraperDataSourceConfig } from './types'

// ===========================================================================
// Interleaved ("deal-cards") scrape cycle.
//
// v1 (scrapeCycle.ts) ran each source to completion before the next, so a
// single domain got its whole burst of detail-page fetches back-to-back. This
// scheduler decomposes the pipeline so detail fetches from ALL sources share
// ONE global queue, served by least-recently-hit host. A domain is therefore
// revisited only after every other domain has had a turn — at scale each host
// sees a request roughly once per full rotation, blending into background noise.
//
// Three phases:
//   1. Listing (per source, sequential): fetch the listing page, extract +
//      fan out rows. One request per host — low burst.
//   2. Detail (ONE global queue): all detail jobs across all sources, popped by
//      least-recently-hit host. Fresh browser context per fetch (clean session,
//      also beats Cloudflare reuse-degradation). Per-host politeness in
//      politeNavigate is the safety net; host-rotation here is the shaper.
//   3. Stage (per source): merge detail fragments, cleanup, ticket-url
//      fallback, stage to /admin/incoming.
// ===========================================================================

export interface InterleavedCycleOptions {
  userId: string
  mode: 'pending' | 'dry-run'
  force?: boolean
  limit?: number
}

export interface CycleRowResult {
  name: string
  host: string
  status: 'staged' | 'cooldown' | 'disabled' | 'robots' | 'error' | 'no-rows'
  rowsExtracted?: number
  rowsValid?: number
  staged?: number
  skipped?: number
  detail?: string
}

interface SourceState {
  id: string
  name: string
  host: string
  config: ScraperDataSourceConfig
  rows: CsvRowInput[]
  rowsExtracted: number
  detailConfig?: DetailFetchConfig
  fragmentsByRow: Map<number, Partial<CsvRowInput>[]>
  detailFetched: number
  detailCacheHits: number
  detailFailed: number
  status: CycleRowResult['status']
  detailMsg?: string
}

interface DetailJob {
  src: SourceState
  rowIndex: number
  row: CsvRowInput
  detailUrl: string
  fingerprint: string
  host: string
}

function hostOf(url: string | undefined): string {
  if (!url) return '(no url)'
  try {
    return new URL(url).host
  } catch {
    return url.slice(0, 40)
  }
}

// Combined detail extraction: JSON-LD, CSS template, or both layered (template
// over the JSON-LD base). Mirrors runScraper's single-source detail extraction.
async function extractDetailFragments(
  page: import('playwright').Page,
  detailConfig: DetailFetchConfig,
  detailUrl: string
): Promise<Partial<CsvRowInput>[]> {
  const ld = detailConfig.jsonLd ? await jsonLdExtractor.extract(page, detailUrl) : []
  const tplEx = detailConfig.template ? makeTemplateExtractor(detailConfig.template) : null
  const tpl = tplEx ? await tplEx.extract(page, detailUrl) : []
  if (ld.length && tpl.length) return tpl.map(t => ({ ...ld[0], ...t }))
  return ld.length ? ld : tpl
}

export async function runInterleavedCycle(
  opts: InterleavedCycleOptions
): Promise<CycleRowResult[]> {
  const force = opts.force ?? false
  const dryRun = opts.mode === 'dry-run'

  const sources = await DataSourceModel.find({
    type: 'scraper',
    purpose: 'scraper',
    isActive: true,
  })
    .sort({ lastPolledAt: 1 })
    .lean()

  const queue = opts.limit ? sources.slice(0, opts.limit) : sources
  const results: CycleRowResult[] = []
  const states: SourceState[] = []

  const browser: Browser = await chromium.launch({ headless: true })
  try {
    // ---- Phase 1: listings (per source) ----
    console.log(`\n=== Interleaved cycle: ${queue.length} active source(s) ===`)
    console.log(`Mode: ${dryRun ? 'dry-run' : 'pending (stages to /admin/incoming)'}${force ? ' | force' : ''}\n`)

    for (const ds of queue) {
      const id = ds._id.toString()
      const config = ds.config as ScraperDataSourceConfig
      const host = hostOf(config?.startUrl || ds.url)

      // Cooldown (unless forced)
      if (!force && ds.lastPolledAt) {
        const cooldownH = ds.cooldownHours ?? DEFAULT_COOLDOWN_HOURS
        const availableAt = new Date(new Date(ds.lastPolledAt).getTime() + cooldownH * 3_600_000)
        if (availableAt > new Date()) {
          results.push({ name: ds.name, host, status: 'cooldown', detail: `until ${availableAt.toISOString()}` })
          continue
        }
      }
      if (!config?.strategy || !config?.startUrl) {
        results.push({ name: ds.name, host, status: 'error', detail: 'missing scraper config' })
        continue
      }

      const context = await browser.newContext({ userAgent: USER_AGENT })
      const page = await context.newPage()
      try {
        await politeNavigate(page, config.startUrl, {
          useCache: false,
          waitForSelector: config.waitFor,
          navTimeoutMs: NAV_TIMEOUT_MS,
        })
        const extractor = pickExtractor(config)
        const fragments = await extractor.extract(page, config.startUrl)
        const capped = fragments.slice(0, config.maxItems ?? DEFAULT_MAX_ITEMS)
        const { rows } = mergeAndValidate(capped, config.rowDefaults, {
          excludeUrlPatterns: config.excludeUrlPatterns,
          includeUrlPatterns: config.includeUrlPatterns,
        })
        const fanned = config.fanOutByDateRange ? expandRowsByDateRange(rows) : rows

        states.push({
          id, name: ds.name, host, config,
          rows: fanned, rowsExtracted: fragments.length,
          detailConfig: config.detail,
          fragmentsByRow: new Map(),
          detailFetched: 0, detailCacheHits: 0, detailFailed: 0,
          status: fanned.length === 0 ? 'no-rows' : 'staged',
        })
        console.log(`  listing  ${ds.name} — ${fanned.length} rows (${host})`)
      } catch (err) {
        if (err instanceof RobotsBlockedError) {
          await markDisabled(id, `robots.txt: ${err.reason}`)
          results.push({ name: ds.name, host, status: 'robots', detail: err.reason })
        } else {
          const msg = err instanceof Error ? err.message : String(err)
          results.push({ name: ds.name, host, status: 'error', detail: msg.slice(0, 160) })
          if (!dryRun) await recordRunOutcome(id, 'failure', msg)
        }
      } finally {
        await context.close()
      }
    }

    // ---- Phase 2: interleaved detail fetches (one global host-rotated queue) ----
    const byHost = new Map<string, DetailJob[]>()
    for (const src of states) {
      if (!src.detailConfig) continue
      const fromField = src.detailConfig.fromField
      src.rows.forEach((row, rowIndex) => {
        const raw = (row as any)[fromField]
        if (!raw) return
        const detailUrl = resolveDetailUrl(String(raw), src.config.startUrl)
        const host = hostOf(detailUrl)
        const job: DetailJob = {
          src, rowIndex, row, detailUrl, host,
          fingerprint: computeFingerprint(row, src.detailConfig!.fingerprint),
        }
        if (!byHost.has(host)) byHost.set(host, [])
        byHost.get(host)!.push(job)
      })
    }

    let remaining = [...byHost.values()].reduce((n, arr) => n + arr.length, 0)
    const totalJobs = remaining
    const lastHit = new Map<string, number>()
    let done = 0
    if (totalJobs > 0) {
      console.log(`\n  detail   ${totalJobs} jobs across ${byHost.size} host(s) — interleaving by least-recently-hit host`)
    }

    while (remaining > 0) {
      // pick the non-empty host whose last hit is oldest (deal-cards rotation)
      let pickHost: string | null = null
      let oldest = Infinity
      for (const [h, arr] of byHost) {
        if (arr.length === 0) continue
        const t = lastHit.get(h) ?? 0
        if (t < oldest) { oldest = t; pickHost = h }
      }
      if (!pickHost) break
      const job = byHost.get(pickHost)!.shift()!
      remaining--

      const { src, detailUrl, fingerprint, rowIndex } = job
      const detailConfig = src.detailConfig!
      let fragments: Partial<CsvRowInput>[] | null = null
      try {
        const cached = await readDetailCache(detailUrl, fingerprint, { maxAgeMs: detailConfig.cacheTtlMs })
        if (cached) {
          fragments = cached.fragments
          src.detailCacheHits++
        } else {
          const ctx = await browser.newContext({ userAgent: USER_AGENT })
          const page = await ctx.newPage()
          try {
            await politeNavigate(page, detailUrl, {
              useCache: false,
              hydrationDelayMs: detailConfig.waitForSelector ? 0 : 3_000,
              waitForPopulated: detailConfig.waitForSelector,
              navTimeoutMs: NAV_TIMEOUT_MS,
            })
            fragments = await extractDetailFragments(page, detailConfig, detailUrl)
          } finally {
            await ctx.close()
          }
          await writeDetailCache(detailUrl, fingerprint, fragments)
          src.detailFetched++
        }
      } catch (err) {
        src.detailFailed++
        console.warn(`  detail fail (${hostOf(detailUrl)}): ${(err as Error).message.slice(0, 100)}`)
      }
      if (fragments && fragments.length) {
        for (const f of fragments) {
          const fAny = f as any
          if (fAny.personName && !fAny.creditType) fAny.creditType = 'cast'
        }
        src.fragmentsByRow.set(rowIndex, fragments)
      }
      lastHit.set(pickHost, Date.now())
      done++
      if (done % 25 === 0) console.log(`  detail   ${done}/${totalJobs} fetched`)
    }

    // ---- Phase 3: stage (per source) ----
    for (const src of states) {
      const { config } = src
      const detailConfig = src.detailConfig
      const workingRows: CsvRowInput[] = []
      src.rows.forEach((row, i) => {
        const frags = src.fragmentsByRow.get(i)
        if (!detailConfig || !frags || frags.length === 0) {
          workingRows.push(row)
        } else if (frags.length === 1) {
          workingRows.push(mergeFragment(row, frags[0], detailConfig.fillIfEmpty))
        } else {
          for (const f of frags) workingRows.push(mergeFragment(row, f, detailConfig.fillIfEmpty))
        }
      })

      // Ticket-URL fallback: detail-page URL (most specific), then strip the
      // internal detail field, then the source listing URL for anything left.
      if (detailConfig) {
        for (const row of workingRows) {
          const tu = (row as any).ticketUrl
          if (!tu || !String(tu).trim()) {
            const du = (row as any)[detailConfig.fromField]
            if (du) (row as any).ticketUrl = resolveDetailUrl(String(du), config.startUrl)
          }
          delete (row as any)[detailConfig.fromField]
        }
      }
      if (config.cleanup) applyRowCleanup(workingRows, config.cleanup)
      for (const row of workingRows) {
        if (!row.ticketUrl || !String(row.ticketUrl).trim()) row.ticketUrl = config.startUrl
      }

      if (config.rehostImages && !dryRun) {
        const n = await rehostRowImages(workingRows, src.id)
        if (n) console.log(`  rehost   ${src.name} — ${n} image(s) to R2`)
      }

      const rowsValid = workingRows.length
      let staged = 0, skipped = 0
      if (!dryRun) {
        if (rowsValid > 0) {
          const stageRes = await stageRowsAsPendingImports(workingRows, { dataSourceId: src.id })
          staged = stageRes.staged
          skipped = stageRes.skipped
        }
        await recordRunOutcome(src.id, rowsValid === 0 ? 'failure' : 'success')
      }

      results.push({
        name: src.name, host: src.host,
        status: rowsValid === 0 ? 'no-rows' : 'staged',
        rowsExtracted: src.rowsExtracted, rowsValid, staged, skipped,
        detail: `detail ${src.detailFetched} fetched / ${src.detailCacheHits} cached / ${src.detailFailed} failed`,
      })
      console.log(`  stage    ${src.name} — ${rowsValid} rows → staged ${staged}, skipped ${skipped}`)
    }
  } finally {
    await browser.close()
  }

  return results
}
