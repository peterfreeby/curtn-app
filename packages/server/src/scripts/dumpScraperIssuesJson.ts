/**
 * Read-only. Emit OPEN ScraperIssues grouped by dataSource as JSON, so the
 * orchestrator can build per-builder briefings. Also maps each dataSource to
 * its create*Source.ts script filename when discoverable via startUrl.
 *
 * Usage:
 *   npx tsnd --clear --transpile-only src/scripts/dumpScraperIssuesJson.ts > /path/out.json
 */

import { connectToDatabase, disconnectFromDatabase } from '../db/mongoose'
import { ScraperIssueModel } from '../entities/scraperIssue/scraperIssueModel'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'

async function main() {
  await connectToDatabase()

  const rows = await ScraperIssueModel.aggregate([
    { $match: { status: 'open' } },
    {
      $group: {
        _id: '$dataSource',
        venueName: { $first: '$venueName' },
        total: { $sum: 1 },
        categories: { $push: '$categories' },
        titles: { $push: '$title' },
        notes: { $push: '$note' },
      },
    },
    { $sort: { total: -1 } },
  ])

  const out = []
  for (const r of rows) {
    const catCounts: Record<string, number> = {}
    for (const arr of r.categories) for (const c of arr ?? []) catCounts[c] = (catCounts[c] ?? 0) + 1
    let startUrl: string | undefined
    if (r._id) {
      const ds = await DataSourceModel.findById(r._id, { url: 1, name: 1 }).lean()
      startUrl = (ds as any)?.url
    }
    out.push({
      dataSource: r._id ? String(r._id) : null,
      venueName: r.venueName ?? null,
      startUrl: startUrl ?? null,
      total: r.total,
      categories: catCounts,
      notes: (r.notes ?? []).filter((n: string) => n && n.trim()),
      sampleTitles: (r.titles ?? []).filter(Boolean).slice(0, 4),
    })
  }

  console.log(JSON.stringify(out, null, 2))
  await disconnectFromDatabase()
}

main().catch(async e => {
  console.error(e)
  await disconnectFromDatabase().catch(() => {})
  process.exit(1)
})
