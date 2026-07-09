/**
 * Read-only verification for the feedback pass. For each dataSource, report how
 * many current PendingImports (pending/flagged, not rejected) now carry a
 * description and an image — so the maestro can confirm a builder's fix landed
 * before resolving that source's ScraperIssues.
 *
 * Usage:
 *   npx tsnd --clear --transpile-only src/scripts/verifyStagedFields.ts <dataSourceId> [<dataSourceId> ...]
 */

import { connectToDatabase, disconnectFromDatabase } from '../db/mongoose'
import { PendingImportModel } from '../entities/pendingImport/pendingImportModel'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'

async function main() {
  const ids = process.argv.slice(2).filter(a => !a.startsWith('--'))
  if (ids.length === 0) { console.error('Provide dataSourceId(s).'); process.exit(1) }

  await connectToDatabase()

  const hasDesc = {
    $or: [
      { showDescription: { $nin: [null, ''] } },
      { runDescription: { $nin: [null, ''] } },
      { performanceDescription: { $nin: [null, ''] } },
    ],
  }
  const hasImg = { imageUrl: { $nin: [null, ''] } }

  console.log('')
  for (const id of ids) {
    const ds = await DataSourceModel.findById(id, { name: 1 }).lean()
    // Count all non-rejected rows — re-staged rows may be pending OR approved.
    const base = { dataSource: id, status: { $ne: 'rejected' } }
    const [total, withDesc, withImg] = await Promise.all([
      PendingImportModel.countDocuments(base),
      PendingImportModel.countDocuments({ ...base, ...hasDesc }),
      PendingImportModel.countDocuments({ ...base, ...hasImg }),
    ])
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)
    const name = (ds as any)?.name ?? id
    console.log(`• ${name}  [${id}]`)
    console.log(`    staged rows: ${total} | with description: ${withDesc} (${pct(withDesc)}%) | with image: ${withImg} (${pct(withImg)}%)`)
    if (total === 0) console.log('    ⚠ no current staged rows — re-stage may not have run, or all rows are past/rejected')
  }
  console.log('')
  await disconnectFromDatabase()
}

main().catch(async e => {
  console.error(e)
  await disconnectFromDatabase().catch(() => {})
  process.exit(1)
})
