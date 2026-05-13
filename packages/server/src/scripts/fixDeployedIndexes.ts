/**
 * One-off cleanup for two indexes that don't match the current schema:
 *
 * 1. `venues.coordinates_2dsphere` — declared in the schema but never queried.
 *    Stored coordinates are `{lat, lng}`, which the 2dsphere index can't
 *    project into a spherical CRS. Surfaced as `MongoServerError: Can't
 *    extract geo keys` whenever a venue is updated. We drop the index and
 *    remove the declaration from the schema.
 *
 * 2. `claimrequests.user_1_person_1` — the schema adds a
 *    `partialFilterExpression: { person: { $type: 'objectId' } }` to make
 *    the unique constraint apply only to legacy rows, but Mongoose doesn't
 *    recreate indexes when options change. The deployed index is still the
 *    pre-Phase-1 non-partial version, which fires `E11000 dup key` on every
 *    new polymorphic claim (those rows have `person: null`).
 *
 * Drop both. On next save, Mongoose's `ensureIndexes` recreates the
 * claimRequest index with the partial filter (the 2dsphere is gone from the
 * schema so it won't come back).
 *
 * Usage:
 *   npx tsnd --clear --transpile-only src/scripts/fixDeployedIndexes.ts
 */

import { connectToDatabase, disconnectFromDatabase } from '../db/mongoose'
import { VenueModel } from '../entities/venue/venueModel'
import { ClaimRequestModel } from '../entities/claimRequest/claimRequestModel'

async function tryDropIndex(model: any, indexName: string, collectionName: string) {
  const indexes = await model.collection.indexes()
  const exists = indexes.some((i: any) => i.name === indexName)
  if (!exists) {
    console.log(`  ${collectionName}.${indexName}: not present, skipping`)
    return
  }
  await model.collection.dropIndex(indexName)
  console.log(`  ${collectionName}.${indexName}: dropped`)
}

async function main() {
  await connectToDatabase()
  console.log('Connected to database\n')

  console.log('Dropping broken / outdated indexes:')
  await tryDropIndex(VenueModel, 'coordinates_2dsphere', 'venues')
  await tryDropIndex(ClaimRequestModel, 'user_1_person_1', 'claimrequests')

  console.log('\nRe-ensuring schema-declared indexes:')
  await VenueModel.ensureIndexes()
  console.log('  venues: ensured')
  await ClaimRequestModel.ensureIndexes()
  console.log('  claimrequests: ensured')

  console.log('\nFinal claimrequest indexes:')
  const finalCRIndexes = await ClaimRequestModel.collection.indexes()
  for (const i of finalCRIndexes) {
    const partial = i.partialFilterExpression ? ` [partial: ${JSON.stringify(i.partialFilterExpression)}]` : ''
    const unique = i.unique ? ' [unique]' : ''
    console.log(`  ${i.name}${unique}${partial}`)
  }

  console.log('\nFinal venue indexes:')
  const finalVIndexes = await VenueModel.collection.indexes()
  for (const i of finalVIndexes) {
    console.log(`  ${i.name}`)
  }

  await disconnectFromDatabase()
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('fixDeployedIndexes failed:', err)
  process.exit(1)
})
