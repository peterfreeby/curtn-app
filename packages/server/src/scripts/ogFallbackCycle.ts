import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { runOgFallbackSource } from '../services/ogFetch'
import { runInterleavedOgCycle } from '../services/ogFetch/runInterleavedOgCycle'

// OG-fallback scheduler — local one-shot cycle, parallel to scrapeCycle.ts.
//
// Run: `npm run og:cycle` (from packages/server) or
//      `npx ts-node src/scripts/ogFallbackCycle.ts [options]`
//
// Does ONE pass over every active og-fallback DataSource (type:'api',
// config.kind:'og-fallback'), ordered least-recently-polled (so an interrupted
// cycle resumes naturally). Each source: discover show URLs → fetch OG stubs via
// the FB Graph API → stage for review. Per-source bookkeeping (lastPolledAt,
// fetchedUrls, consecutiveFailures) is handled inside runOgFallbackSource.
//
// Kept separate from the scraper cycle on purpose: OG sources use a different
// runner (no template/Playwright-fetch), share one rate budget (the FB app),
// and run on a slower cadence (venue seasons change a few times a year).
//
// Runs to completion: when the FB rolling-hour budget is exhausted it waits the
// window out and resumes, and it persists progress in batches — so you can kick
// it off and let it run overnight against hundreds of items. An interrupted run
// resumes cleanly on the next invocation (least-recently-polled + fetchedUrls).
//
// Options:
//   --force            Re-fetch URLs already in fetchedUrls (re-scrape the season)
//   --limit=<n>        Only process the first n sources
//   --delay=<ms>       Inter-source delay (default: 3000)
//   --fetch-delay=<ms> Base delay between FB calls within a source (default: 1500)
//   --cooldown=<ms>    Pause chunk when the FB budget is hot/throttled (default: 300000 = 5min)
//   --dry-run          Discover + fetch + print, no staging, no source mutation
//   --sequential       Old per-source loop (run each source to completion). Default
//                      is the interleaved round-robin: discover per source, then
//                      rotate FB fetches across all sources through ONE shared
//                      governor, so a slow/hung source can't starve the rest.

interface CycleRowResult {
  name: string
  status: 'staged' | 'no-new' | 'partial' | 'error'
  discovered?: number
  staged?: number
  skipped?: number
  failed?: number
  detail?: string
  durationMs: number
}

function parseArgs(argv: string[]) {
  const flags = new Set<string>()
  const opts: Record<string, string> = {}
  for (const a of argv) {
    if (a.startsWith('--') && a.includes('=')) {
      const [k, v] = a.slice(2).split('=')
      opts[k] = v
    } else if (a.startsWith('--')) {
      flags.add(a.slice(2))
    }
  }
  return { flags, opts }
}

async function main() {
  const { flags, opts } = parseArgs(process.argv.slice(2))
  const force = flags.has('force')
  const dryRun = flags.has('dry-run')
  const limit = opts.limit ? parseInt(opts.limit, 10) : Infinity
  const interSourceDelayMs = opts.delay ? parseInt(opts.delay, 10) : 3000
  const fetchDelayMs = opts['fetch-delay'] ? parseInt(opts['fetch-delay'], 10) : 1500
  const cooldownMs = opts.cooldown ? parseInt(opts.cooldown, 10) : 300_000

  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  const startedAt = Date.now()
  const results: CycleRowResult[] = []

  try {
    // DEFAULT: interleaved round-robin — discover per source, then rotate FB
    // fetches across all sources through ONE shared governor. A slow/hung
    // source no longer starves the rest. Pass --sequential for the old
    // run-each-source-to-completion loop.
    if (!flags.has('sequential')) {
      const cycleResults = await runInterleavedOgCycle({
        dryRun,
        force,
        limit: limit === Infinity ? undefined : limit,
        governor: { baseDelayMs: fetchDelayMs, cooldownMs },
      })
      const totalMs = Date.now() - startedAt
      const byStatus = cycleResults.reduce<Record<string, number>>((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a }, {})
      const totalStaged = cycleResults.reduce((s, r) => s + (r.staged ?? 0), 0)
      const totalSkipped = cycleResults.reduce((s, r) => s + (r.skipped ?? 0), 0)
      console.log(`\n=== OG cycle complete in ${(totalMs / 1000 / 60).toFixed(1)} min (interleaved) ===`)
      console.log(`Sources: ${cycleResults.length} | ` + Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(' | '))
      console.log(`PendingImports staged: ${totalStaged} | skipped (dup): ${totalSkipped}`)
      const problems = cycleResults.filter(r => r.status === 'error' || r.status === 'partial')
      if (problems.length) {
        console.log(`\nNeeds attention:`)
        for (const p of problems) {
          const tag = p.status === 'partial' ? 'PARTIAL' : 'ERROR  '
          const note = p.status === 'partial' ? 're-run to resume' : p.detail ?? ''
          console.log(`  ${tag} ${p.name}${note ? ` — ${note}` : ''}`)
        }
      }
      return
    }

    // Hydrated docs (not .lean()) — the runner mutates + saves each source.
    const sources = await DataSourceModel.find({
      type: 'api',
      'config.kind': 'og-fallback',
      isActive: true
    }).sort({ lastPolledAt: 1 }) // nulls (never polled) sort first

    const queue = sources.slice(0, limit === Infinity ? sources.length : limit)

    console.log(`\n=== OG-fallback cycle: ${queue.length} active source(s) ===`)
    console.log(`Mode: ${dryRun ? 'dry-run' : 'pending (stages to /admin/incoming)'}${force ? ' | force (re-fetch all URLs)' : ''}`)
    console.log(`Ordered by least-recently-polled. Inter-source delay: ${interSourceDelayMs}ms, FB call delay: ${fetchDelayMs}ms\n`)

    for (let i = 0; i < queue.length; i++) {
      const ds = queue[i]
      const t0 = Date.now()
      const label = `[${i + 1}/${queue.length}] ${ds.name}`

      try {
        const r = await runOgFallbackSource(ds, {
          dryRun,
          forceRefresh: force,
          governor: { baseDelayMs: fetchDelayMs, cooldownMs },
          onProgress: line => console.log(`    ${line}`)
        })
        const durationMs = Date.now() - t0

        if (r.attempted === 0 && !r.stoppedEarly) {
          results.push({ name: ds.name, status: 'no-new', discovered: r.discovered, durationMs })
          console.log(`${label} — • no new URLs (${r.discovered} discovered, all seen) [${(durationMs / 1000).toFixed(1)}s]`)
        } else {
          const status = r.stoppedEarly ? 'partial' : 'staged'
          results.push({
            name: ds.name, status,
            discovered: r.discovered, staged: r.staged, skipped: r.skipped, failed: r.failed, durationMs
          })
          const tail = r.stoppedEarly ? ' ⏹ stopped early (budget) — re-run to resume' : ''
          console.log(`${label} — ✓ ${r.parsed} parsed → staged ${r.staged}, skipped(dup) ${r.skipped}, failed ${r.failed}${tail} [${(durationMs / 1000 / 60).toFixed(1)}min]`)
        }
      } catch (err) {
        const durationMs = Date.now() - t0
        const msg = err instanceof Error ? err.message : String(err)
        results.push({ name: ds.name, status: 'error', detail: msg.slice(0, 160), durationMs })
        console.log(`${label} — ✗ error: ${msg.slice(0, 160)}`)
      }

      if (i < queue.length - 1 && interSourceDelayMs > 0) {
        await new Promise(r => setTimeout(r, interSourceDelayMs))
      }
    }

    const totalMs = Date.now() - startedAt
    const byStatus = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    }, {})
    const totalStaged = results.reduce((sum, r) => sum + (r.staged ?? 0), 0)
    const totalSkipped = results.reduce((sum, r) => sum + (r.skipped ?? 0), 0)

    console.log(`\n=== OG cycle complete in ${(totalMs / 1000 / 60).toFixed(1)} min ===`)
    console.log(`Sources: ${results.length} | ` + Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(' | '))
    console.log(`PendingImports staged: ${totalStaged} | skipped (dup): ${totalSkipped}`)

    const problems = results.filter(r => r.status === 'error' || r.status === 'partial')
    if (problems.length) {
      console.log(`\nNeeds attention:`)
      for (const p of problems) {
        const tag = p.status === 'partial' ? 'PARTIAL ' : 'ERROR   '
        const note = p.status === 'partial' ? 're-run to resume (FB budget)' : p.detail ?? ''
        console.log(`  ${tag} ${p.name}${note ? ` — ${note}` : ''}`)
      }
    }
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
