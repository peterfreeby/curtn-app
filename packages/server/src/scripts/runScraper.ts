import '../config/env'
import mongoose from 'mongoose'
import { UserModel } from '../entities/user/userModel'
import { runScraper, CooldownActiveError, SourceDisabledError, type RunMode } from '../services/scraping/runScraper'
import { RobotsBlockedError } from '../services/scraping/politeNavigate'

function parseArgs(argv: string[]) {
  const positional: string[] = []
  const flags = new Set<string>()
  for (const a of argv) {
    if (a.startsWith('--')) flags.add(a.slice(2))
    else positional.push(a)
  }
  return { positional, flags }
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2))
  const dataSourceId = positional[0]
  if (!dataSourceId) {
    console.error('Usage: runScraper.ts <dataSourceId> [--direct] [--dry-run] [--force] [--use-cache] [--user <username>]')
    process.exit(1)
  }

  let mode: RunMode = 'pending'
  if (flags.has('dry-run')) mode = 'dry-run'
  else if (flags.has('direct')) mode = 'direct'

  const force = flags.has('force')
  const useCache = flags.has('use-cache')

  const userIdx = process.argv.indexOf('--user')
  const username = userIdx > -1 ? process.argv[userIdx + 1] : 'peter'

  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const user = await UserModel.findOne({ username })
    if (!user || !user.isAdmin) {
      console.error(`Admin user "${username}" not found`)
      process.exit(1)
    }

    console.log(`Running scraper for DataSource ${dataSourceId} in ${mode} mode${force ? ' (forced)' : ''}${useCache ? ' (cache enabled)' : ''}...`)
    let result
    try {
      result = await runScraper({
        dataSourceId,
        userId: user._id.toString(),
        mode,
        force,
        useCache
      })
    } catch (err) {
      if (err instanceof CooldownActiveError) {
        console.error()
        console.error(`Source is in cooldown until ${err.availableAt.toISOString()}`)
        console.error('Pass --force to override (use sparingly — be polite to the venue site).')
        process.exit(2)
      }
      if (err instanceof SourceDisabledError) {
        console.error()
        console.error(`Source is disabled: ${err.message}`)
        console.error('Re-enable via the admin UI or pass --force.')
        process.exit(2)
      }
      if (err instanceof RobotsBlockedError) {
        console.error()
        console.error(`robots.txt blocked the fetch: ${err.reason}`)
        console.error('Source has been auto-disabled. If you have permission, contact the venue and re-enable manually.')
        process.exit(2)
      }
      throw err
    }

    if (result.fromCache) {
      console.log('(served from disk cache)')
    }

    console.log()
    console.log(`Rows extracted: ${result.rowsExtracted}`)
    console.log(`Rows valid:     ${result.rowsValid}`)

    if (result.staging) {
      console.log(`Staged:         ${result.staging.staged}`)
      console.log(`Skipped (dup):  ${result.staging.skipped}`)
    }
    if (result.importResult) {
      const r = result.importResult
      console.log(`Shows:          ${r.showsCreated} created / ${r.showsMatched} matched`)
      console.log(`Runs:           ${r.runsCreated} created / ${r.runsMatched} matched`)
      console.log(`Performances:   ${r.performancesCreated} created / ${r.performancesMatched} matched`)
      console.log(`Venues:         ${r.venuesCreated} created / ${r.venuesMatched} matched`)
      if (r.errors.length) {
        console.log()
        console.log('Errors:')
        r.errors.slice(0, 10).forEach(e => console.log(`  - ${e}`))
      }
    }
    if (result.rows) {
      console.log()
      console.log('Dry-run sample (first 3 rows):')
      console.log(JSON.stringify(result.rows.slice(0, 3), null, 2))
    }
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
