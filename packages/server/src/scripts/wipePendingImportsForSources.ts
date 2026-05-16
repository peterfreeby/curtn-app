import '../config/env'
import mongoose from 'mongoose'
import { PendingImportModel } from '../entities/pendingImport/pendingImportModel'

// One-shot: delete PendingImports for the named DataSources. Used after
// fixing an extractor bug to re-stage with clean rows. Takes DataSource IDs
// as positional args.

async function main() {
  const ids = process.argv.slice(2).filter(a => !a.startsWith('--'))
  if (ids.length === 0) {
    console.error('Usage: wipePendingImportsForSources.ts <dataSourceId> [<dataSourceId>...]')
    process.exit(1)
  }

  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    for (const id of ids) {
      const result = await PendingImportModel.deleteMany({ dataSource: id })
      console.log(`  ${id}: deleted ${result.deletedCount} PendingImports`)
    }
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
