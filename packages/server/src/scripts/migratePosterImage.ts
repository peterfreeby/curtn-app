/**
 * Migration: for shows/runs that have an image only in `imageUrl` (splash) and no
 * `posterUrl`, move that image to `posterUrl` and clear `imageUrl`. Rationale: for
 * ~45% of shows the only image lives in `imageUrl` and functions as the poster, so
 * once the app treats `imageUrl` strictly as a background splash (never a poster),
 * those would go blank in previews. Moving it to `posterUrl` makes it the poster
 * (which is what it is) and leaves splash empty (a splash is optional background).
 *
 * Dry-run by default (reports counts). Pass --execute to write.
 *
 *   yarn tsnd --transpile-only src/scripts/migratePosterImage.ts            # dry run
 *   yarn tsnd --transpile-only src/scripts/migratePosterImage.ts --execute  # write
 */
import { connectToDatabase, disconnectFromDatabase } from '../db/mongoose'
import { ShowModel } from '../entities/show/showModel'
import { RunModel } from '../entities/run/runModel'

const EXECUTE = process.argv.includes('--execute')

// Matches docs with a splash image but no poster.
const FILTER = { posterUrl: { $in: [null, ''] }, imageUrl: { $nin: [null, ''] } }

// Aggregation-pipeline update: copy imageUrl into posterUrl, then blank imageUrl.
const UPDATE = [
  { $set: { posterUrl: '$imageUrl' } },
  { $set: { imageUrl: '' } }
]

async function migrateModel (name: string, Model: any) {
  const count = await Model.countDocuments(FILTER)
  console.log(`${name}: ${count} document(s) to migrate (imageUrl → posterUrl)`)
  if (EXECUTE && count > 0) {
    const res = await Model.updateMany(FILTER, UPDATE)
    console.log(`  ✓ ${name}: modified ${res.modifiedCount}`)
  }
}

async function main () {
  await connectToDatabase()
  console.log(EXECUTE ? '=== EXECUTING ===' : '=== DRY RUN (no writes; pass --execute to apply) ===')
  await migrateModel('Show', ShowModel)
  await migrateModel('Run', RunModel)
  console.log('Done.')
  await disconnectFromDatabase()
}

main().catch(e => { console.error(e); process.exit(1) })
