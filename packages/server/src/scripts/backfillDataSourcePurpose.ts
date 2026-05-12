/**
 * Backfill DataSource.purpose for documents created before Phase 6.
 *
 * Phase 6 adds the `purpose` field with default `'scraper'`. Mongoose
 * defaults don't retroactively populate existing documents on .lean() reads
 * (lesson from Phase 1 backfill), so we explicitly set the field.
 *
 * Idempotent.
 *
 * Usage:
 *   npx tsnd --clear --transpile-only src/scripts/backfillDataSourcePurpose.ts
 */

import { connectToDatabase, disconnectFromDatabase } from '../db/mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'

async function main() {
  await connectToDatabase()
  console.log('Connected to database\n')

  const before = await DataSourceModel.countDocuments({ purpose: { $exists: false } })
  console.log(`DataSources without purpose: ${before}`)

  const result = await DataSourceModel.updateMany(
    { purpose: { $exists: false } },
    { $set: { purpose: 'scraper' } }
  )
  console.log(`Updated ${result.modifiedCount} row(s).`)

  const after = await DataSourceModel.countDocuments({ purpose: { $exists: false } })
  console.log(`DataSources still without purpose: ${after}`)

  await disconnectFromDatabase()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
