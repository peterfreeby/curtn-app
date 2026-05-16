import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import {
  runScraper,
  CooldownActiveError,
  SourceDisabledError
} from '../services/scraping/runScraper'
import { RobotsBlockedError } from '../services/scraping/politeNavigate'

// Round-robin scrape scheduler — local one-shot cycle.
//
// Run: `npm run scrape:cycle` (from packages/server) or
//      `npx ts-node src/scripts/scrapeCycle.ts [options]`
//
// Does ONE full pass over every active scraper DataSource, ordered by
// least-recently-polled (so a cycle that's interrupted and restarted naturally
// resumes where it left off — no separate job queue or resume logic needed).
// All per-source bookkeeping (lastPolledAt, consecutiveFailures, circuit
// breaker, cooldown) is handled inside runScraper; this is purely the
// orchestration loop.
//
// Politeness: per-host rate limiting (5s + jitter, robots.txt, 24h cooldown)
// lives in politeNavigate and fires automatically per source. Because sources
// are mostly distinct hosts and we go least-recently-polled first, load is
// naturally spread. A small inter-source delay is added as belt-and-suspenders
// for the rare case where two sources share a host.
//
// Options:
//   --force          Bypass the 24h per-source cooldown (use sparingly)
//   --limit=<n>      Only process the first n sources (debugging)
//   --delay=<ms>     Inter-source delay (default: 3000)
//   --user=<name>    Admin username to attribute imports to (default: any admin)
//   --dry-run        Run extraction but don't stage (per-source dry-run)

interface CycleRowResult {
  name: string
  host: string
  status: 'staged' | 'cooldown' | 'disabled' | 'robots' | 'error' | 'no-rows'
  rowsExtracted?: number
  rowsValid?: number
  staged?: number
  skipped?: number
  detail?: string
  durationMs: number
}

function hostOf(url: string | undefined): string {
  if (!url) return '(no url)'
  try {
    return new URL(url).host
  } catch {
    return url.slice(0, 40)
  }
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

  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  const startedAt = Date.now()
  const results: CycleRowResult[] = []

  try {
    const user = opts.user
      ? await UserModel.findOne({ username: opts.user })
      : await UserModel.findOne({ isAdmin: true })
    if (!user || !user.isAdmin) {
      throw new Error(opts.user ? `Admin user "${opts.user}" not found` : 'No admin user found')
    }

    // Active, scraper-purpose sources only. claimant-sync sources are the
    // Phase 6 owner-driven path and run through a different executor.
    const sources = await DataSourceModel.find({
      type: 'scraper',
      purpose: 'scraper',
      isActive: true
    })
      .sort({ lastPolledAt: 1 }) // nulls (never polled) sort first in Mongo
      .lean()

    const queue = sources.slice(0, limit)

    console.log(`\n=== Scrape cycle: ${queue.length} active source(s) ===`)
    console.log(`Mode: ${dryRun ? 'dry-run' : 'pending (stages to /admin/incoming)'}${force ? ' | force (cooldown bypassed)' : ''}`)
    console.log(`Ordered by least-recently-polled. Inter-source delay: ${interSourceDelayMs}ms\n`)

    for (let i = 0; i < queue.length; i++) {
      const ds = queue[i]
      const id = ds._id.toString()
      const host = hostOf((ds.config as any)?.startUrl || ds.url)
      const t0 = Date.now()
      const label = `[${i + 1}/${queue.length}] ${ds.name}`

      try {
        const result = await runScraper({
          dataSourceId: id,
          userId: user._id.toString(),
          mode: dryRun ? 'dry-run' : 'pending',
          force
        })
        const durationMs = Date.now() - t0

        if (result.rowsValid === 0) {
          results.push({ name: ds.name, host, status: 'no-rows', rowsExtracted: result.rowsExtracted, rowsValid: 0, durationMs })
          console.log(`${label} — ⚠ 0 valid rows (${result.rowsExtracted} extracted) [${(durationMs / 1000).toFixed(1)}s]`)
        } else {
          const staged = result.staging?.staged ?? 0
          const skipped = result.staging?.skipped ?? 0
          results.push({
            name: ds.name, host, status: 'staged',
            rowsExtracted: result.rowsExtracted, rowsValid: result.rowsValid,
            staged, skipped, durationMs
          })
          console.log(`${label} — ✓ ${result.rowsValid} valid → staged ${staged}, skipped(dup) ${skipped} [${(durationMs / 1000).toFixed(1)}s]`)
        }
      } catch (err) {
        const durationMs = Date.now() - t0
        if (err instanceof CooldownActiveError) {
          results.push({ name: ds.name, host, status: 'cooldown', detail: `until ${err.availableAt.toISOString()}`, durationMs })
          console.log(`${label} — ⏳ cooldown until ${err.availableAt.toISOString()} (skipped)`)
        } else if (err instanceof SourceDisabledError) {
          results.push({ name: ds.name, host, status: 'disabled', detail: err.message, durationMs })
          console.log(`${label} — ⊘ disabled: ${err.message} (skipped)`)
        } else if (err instanceof RobotsBlockedError) {
          results.push({ name: ds.name, host, status: 'robots', detail: err.reason, durationMs })
          console.log(`${label} — ⊘ robots.txt blocked: ${err.reason} (auto-disabled)`)
        } else {
          const msg = err instanceof Error ? err.message : String(err)
          results.push({ name: ds.name, host, status: 'error', detail: msg.slice(0, 160), durationMs })
          console.log(`${label} — ✗ error: ${msg.slice(0, 160)}`)
          // runScraper already incremented consecutiveFailures + may have
          // tripped the circuit breaker; nothing more to do here.
        }
      }

      if (i < queue.length - 1 && interSourceDelayMs > 0) {
        await new Promise(r => setTimeout(r, interSourceDelayMs))
      }
    }

    // End-of-cycle summary
    const totalMs = Date.now() - startedAt
    const byStatus = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    }, {})
    const totalStaged = results.reduce((sum, r) => sum + (r.staged ?? 0), 0)
    const totalSkipped = results.reduce((sum, r) => sum + (r.skipped ?? 0), 0)

    console.log(`\n=== Cycle complete in ${(totalMs / 1000 / 60).toFixed(1)} min ===`)
    console.log(`Sources: ${results.length} | ` + Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(' | '))
    console.log(`PendingImports staged: ${totalStaged} | skipped (dup): ${totalSkipped}`)

    const problems = results.filter(r => r.status === 'error' || r.status === 'no-rows' || r.status === 'robots')
    if (problems.length) {
      console.log(`\nNeeds attention:`)
      for (const p of problems) {
        console.log(`  ${p.status.toUpperCase().padEnd(8)} ${p.name}${p.detail ? ` — ${p.detail}` : ''}`)
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
