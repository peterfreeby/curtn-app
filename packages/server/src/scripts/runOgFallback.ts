import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { runOgFallbackSource } from '../services/ogFetch'

// Run an OG-fallback DataSource: discover show URLs, fetch OG stubs via the FB
// Graph API, and stage them for review at /admin/incoming. Mirrors runScraper.
//
// Usage (from packages/server):
//   npx ts-node src/scripts/runOgFallback.ts <dataSourceId> [--dry-run] [--limit=n] [--delay=ms] [--cooldown=ms] [--force]
//     --dry-run      discover + fetch + print, no staging, no source mutation
//     --limit=n      cap URLs processed this run
//     --delay=ms     base delay between FB calls (default 1500)
//     --cooldown=ms  pause chunk when the FB budget is hot/throttled (default 300000 = 5min)
//     --force        re-fetch URLs already in fetchedUrls
//
// Runs to completion: waits out the FB rolling-hour budget and resumes, and
// persists progress in batches so an interrupted run picks up where it left off.

function parseArgs() {
  const args = process.argv.slice(2)
  const dataSourceId = args.find(a => !a.startsWith('--'))
  const limitArg = args.find(a => a.startsWith('--limit='))
  const delayArg = args.find(a => a.startsWith('--delay='))
  const cooldownArg = args.find(a => a.startsWith('--cooldown='))
  return {
    dataSourceId,
    dryRun: args.includes('--dry-run'),
    forceRefresh: args.includes('--force'),
    limit: limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined,
    delayMs: delayArg ? parseInt(delayArg.split('=')[1], 10) : 1500,
    cooldownMs: cooldownArg ? parseInt(cooldownArg.split('=')[1], 10) : 300_000
  }
}

async function main() {
  const { dataSourceId, dryRun, forceRefresh, limit, delayMs, cooldownMs } = parseArgs()
  if (!dataSourceId) {
    console.error('Usage: runOgFallback.ts <dataSourceId> [--dry-run] [--limit=n] [--delay=ms] [--force]')
    process.exit(1)
  }

  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const ds = await DataSourceModel.findById(dataSourceId)
    if (!ds) throw new Error(`DataSource ${dataSourceId} not found`)

    console.log(`OG fallback — ${ds.name}${dryRun ? '  [DRY RUN]' : ''}\n`)
    const result = await runOgFallbackSource(ds, {
      dryRun,
      forceRefresh,
      limit,
      governor: { baseDelayMs: delayMs, cooldownMs },
      onProgress: line => console.log(line)
    })

    console.log(
      `\nDiscovered ${result.discovered}, attempted ${result.attempted}, parsed ${result.parsed}, ` +
        `staged ${result.staged}, skipped ${result.skipped}, failed ${result.failed}`
    )
    if (result.stoppedEarly) console.log('⏹ Stopped early — FB budget exhausted past max wait. Re-run to resume (progress saved).')
    if (!dryRun && result.staged) console.log('Review at /admin/incoming')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
