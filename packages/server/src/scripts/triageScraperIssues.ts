/**
 * Read-only triage of the ScraperIssue log.
 * Rolls up OPEN issues by dataSource and category so we can size the fix work.
 *
 * Usage:
 *   npx tsnd --clear --transpile-only src/scripts/triageScraperIssues.ts
 */

import { connectToDatabase, disconnectFromDatabase } from '../db/mongoose'
import { ScraperIssueModel } from '../entities/scraperIssue/scraperIssueModel'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'

async function main() {
  await connectToDatabase()

  const [openCount, resolvedCount, acceptedCount] = await Promise.all([
    ScraperIssueModel.countDocuments({ status: 'open' }),
    ScraperIssueModel.countDocuments({ status: 'resolved' }),
    ScraperIssueModel.countDocuments({ status: 'accepted' }),
  ])
  console.log(
    `\nScraperIssue totals: ${openCount} open, ${resolvedCount} resolved, ${acceptedCount} accepted (verified-unavailable)\n`
  )

  // Sources with fields marked verified-unavailable — these gaps are expected,
  // not fix work, so they never appear in the open rollup below.
  const withGaps = await DataSourceModel.find(
    { acceptedGaps: { $exists: true, $ne: [] } },
    { name: 1, acceptedGaps: 1 }
  ).lean()
  if (withGaps.length) {
    console.log('=== Verified-unavailable fields by source ===')
    for (const s of withGaps) {
      console.log(`  ${s.name}: ${(s.acceptedGaps ?? []).join(', ')}`)
    }
    console.log('')
  }

  if (openCount === 0) {
    await disconnectFromDatabase()
    return
  }

  // Category totals across all open issues
  const byCategory = await ScraperIssueModel.aggregate([
    { $match: { status: 'open' } },
    { $unwind: { path: '$categories', preserveNullAndEmptyArrays: true } },
    { $group: { _id: '$categories', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ])
  console.log('=== Open issues by category ===')
  for (const c of byCategory) {
    console.log(`  ${(c._id ?? '(note-only)').padEnd(22)} ${c.count}`)
  }

  // Per-source rollup: total open issues + category breakdown + sample titles
  const bySource = await ScraperIssueModel.aggregate([
    { $match: { status: 'open' } },
    {
      $group: {
        _id: '$dataSource',
        venueName: { $first: '$venueName' },
        total: { $sum: 1 },
        categories: { $push: '$categories' },
        sampleTitles: { $push: '$title' },
        notes: { $push: '$note' },
      },
    },
    { $sort: { total: -1 } },
  ])

  console.log(`\n=== Open issues by source (${bySource.length} sources) ===`)
  for (const s of bySource) {
    const catCounts: Record<string, number> = {}
    for (const arr of s.categories) {
      for (const cat of arr ?? []) catCounts[cat] = (catCounts[cat] ?? 0) + 1
    }
    const catStr = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${v}`)
      .join(', ')
    const notes = (s.notes ?? []).filter((n: string) => n && n.trim())
    console.log(`\n• ${s.venueName ?? '(unknown venue)'}  [dataSource ${s._id}]  — ${s.total} open`)
    console.log(`    categories: ${catStr || '(none — note-only)'}`)
    const titles = (s.sampleTitles ?? []).filter(Boolean).slice(0, 3)
    if (titles.length) console.log(`    sample: ${titles.join(' | ')}`)
    if (notes.length) {
      for (const n of notes.slice(0, 3)) console.log(`    note: "${n}"`)
    }
  }

  console.log('')
  await disconnectFromDatabase()
}

main().catch(async e => {
  console.error(e)
  await disconnectFromDatabase().catch(() => {})
  process.exit(1)
})
