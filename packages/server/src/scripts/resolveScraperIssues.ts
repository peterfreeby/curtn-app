/**
 * Reconciliation: flip OPEN ScraperIssues to resolved for one or more
 * dataSources, after their scraper fix has been verified + re-staged.
 * Centralized DB write (maestro-only) — builders never touch this.
 *
 * Verify-first, then resolve. Default is a DRY RUN (prints what it would do).
 * Pass --commit to actually write. Optionally scope to specific categories.
 *
 * Usage:
 *   # dry run, all open issues for these sources:
 *   npx tsnd --clear --transpile-only src/scripts/resolveScraperIssues.ts <dataSourceId> [<dataSourceId> ...]
 *   # commit:
 *   npx tsnd ... resolveScraperIssues.ts --commit <dataSourceId> ...
 *   # only resolve specific categories on a source (e.g. images fixed, desc still open):
 *   npx tsnd ... resolveScraperIssues.ts --commit --categories=missing_image,image_hosting_error <dataSourceId>
 */

import { connectToDatabase, disconnectFromDatabase } from '../db/mongoose'
import { ScraperIssueModel } from '../entities/scraperIssue/scraperIssueModel'

async function main() {
  const argv = process.argv.slice(2)
  const commit = argv.includes('--commit')
  const catArg = argv.find(a => a.startsWith('--categories='))
  const categories = catArg ? catArg.split('=')[1].split(',').map(s => s.trim()).filter(Boolean) : null
  const ids = argv.filter(a => !a.startsWith('--'))

  if (ids.length === 0) {
    console.error('Provide at least one dataSourceId. See header for usage.')
    process.exit(1)
  }

  await connectToDatabase()

  const filter: Record<string, unknown> = { status: 'open', dataSource: { $in: ids } }
  // Category-scoped resolve: only issues whose flagged categories are ALL within
  // the provided set (so a mixed image+desc issue isn't closed by an image-only fix).
  if (categories) {
    filter.categories = { $not: { $elemMatch: { $nin: categories } }, $ne: [] }
  }

  const matched = await ScraperIssueModel.find(filter, { title: 1, venueName: 1, categories: 1, dataSource: 1 }).lean()

  console.log(`\n${commit ? 'COMMIT' : 'DRY RUN'} — ${matched.length} open issue(s) match`)
  if (categories) console.log(`  category scope: ${categories.join(', ')}`)
  const byVenue: Record<string, number> = {}
  for (const m of matched) byVenue[(m as any).venueName ?? String((m as any).dataSource)] = (byVenue[(m as any).venueName ?? String((m as any).dataSource)] ?? 0) + 1
  for (const [v, n] of Object.entries(byVenue).sort((a, b) => b[1] - a[1])) console.log(`  ${v}: ${n}`)

  if (!commit) {
    console.log('\n(dry run — pass --commit to resolve)')
    await disconnectFromDatabase()
    return
  }

  const res = await ScraperIssueModel.updateMany(filter, { $set: { status: 'resolved', resolvedAt: new Date() } })
  console.log(`\nResolved ${res.modifiedCount} issue(s).`)
  await disconnectFromDatabase()
}

main().catch(async e => {
  console.error(e)
  await disconnectFromDatabase().catch(() => {})
  process.exit(1)
})
