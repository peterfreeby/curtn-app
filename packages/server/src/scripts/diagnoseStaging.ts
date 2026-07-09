/**
 * Read-only diagnostic: for each dataSource, break PendingImports down by status,
 * show the most recent importedAt, and how many rows (ANY status) carry a
 * description/image. Distinguishes "re-stage produced nothing" from "re-staged
 * but field still empty" from "rows exist under approved/rejected".
 *
 * Usage: npx tsnd --clear --transpile-only src/scripts/diagnoseStaging.ts <id> [<id> ...]
 */

import { connectToDatabase, disconnectFromDatabase } from '../db/mongoose'
import { PendingImportModel } from '../entities/pendingImport/pendingImportModel'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import mongoose from 'mongoose'

async function main() {
  const ids = process.argv.slice(2).filter(a => !a.startsWith('--'))
  await connectToDatabase()
  console.log('DB:', mongoose.connection.name, '\n')

  const hasDesc = { $or: [{ showDescription: { $nin: [null, ''] } }, { runDescription: { $nin: [null, ''] } }, { performanceDescription: { $nin: [null, ''] } }] }

  for (const id of ids) {
    const ds = await DataSourceModel.findById(id, { name: 1 }).lean()
    const rows = await PendingImportModel.aggregate([
      { $match: { dataSource: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: '$status', n: { $sum: 1 }, lastImported: { $max: '$importedAt' } } },
    ])
    const totalAny = await PendingImportModel.countDocuments({ dataSource: id })
    const descAny = await PendingImportModel.countDocuments({ dataSource: id, ...hasDesc })
    const recent = await PendingImportModel.find({ dataSource: id }, { title: 1, status: 1, showDescription: 1, imageUrl: 1, importedAt: 1, date: 1 })
      .sort({ importedAt: -1 }).limit(3).lean()
    console.log(`• ${(ds as any)?.name ?? id}  [${id}]`)
    console.log(`    total(any status): ${totalAny} | with description(any status): ${descAny}`)
    console.log(`    by status: ${rows.map(r => `${r._id}:${r.n}(last ${r.lastImported ? new Date(r.lastImported).toISOString().slice(0,16) : '?'})`).join(', ') || '(none)'}`)
    for (const r of recent) {
      const d = (r as any).showDescription ? `desc:${String((r as any).showDescription).length}c` : 'desc:—'
      const img = (r as any).imageUrl ? 'img:Y' : 'img:—'
      const dt = (r as any).date ? new Date((r as any).date).toISOString().slice(0,10) : 'nodate'
      console.log(`      [${(r as any).status}] ${dt} ${d} ${img}  ${String((r as any).title).slice(0,50)}`)
    }
    console.log('')
  }
  await disconnectFromDatabase()
}

main().catch(async e => { console.error(e); await disconnectFromDatabase().catch(() => {}); process.exit(1) })
