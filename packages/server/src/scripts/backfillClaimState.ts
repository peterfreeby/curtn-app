/**
 * Backfill claim state on Venue, ProductionCompany, Person.
 *
 * Phase 1 migration for the Claim & Edit Authority Model.
 *   - All Venue/ProductionCompany default to `unclaimed`
 *   - Person with `userId` set → `claimed-passive` + `claimedBy` populated
 *   - Pending ClaimRequest targeting a Person → that Person → `provisionally-claimed`
 *   - All existing ClaimRequest rows → backfill `target` from legacy `person`
 *
 * Idempotent: re-running produces the same result.
 *
 * Usage:
 *   npx tsnd --clear --transpile-only src/scripts/backfillClaimState.ts
 */

import { connectToDatabase, disconnectFromDatabase } from '../db/mongoose'
import { VenueModel } from '../entities/venue/venueModel'
import { ProductionCompanyModel } from '../entities/productionCompany/productionCompanyModel'
import { PersonModel } from '../entities/person/personModel'
import { ClaimRequestModel } from '../entities/claimRequest/claimRequestModel'

async function main() {
  await connectToDatabase()
  console.log('Connected to database\n')

  await printCounts('Before')

  // 1. Venue + ProductionCompany + Person — set claimState to unclaimed where missing.
  //    Default is 'unclaimed' on the schema, but explicit backfill handles
  //    documents created before the field was added.
  const blankInit = { claimState: 'unclaimed', claimedBy: null, claimedAt: null, syncHealth: null, syncSourceConnectedAt: null, lastClaimantActivityAt: null }

  const venueResult = await VenueModel.updateMany(
    { claimState: { $exists: false } },
    { $set: blankInit }
  )
  console.log(`Venue: ${venueResult.modifiedCount} records initialized to unclaimed`)

  const companyResult = await ProductionCompanyModel.updateMany(
    { claimState: { $exists: false } },
    { $set: blankInit }
  )
  console.log(`ProductionCompany: ${companyResult.modifiedCount} records initialized to unclaimed`)

  const personInitResult = await PersonModel.updateMany(
    { claimState: { $exists: false } },
    { $set: blankInit }
  )
  console.log(`Person: ${personInitResult.modifiedCount} records initialized to unclaimed`)

  // 2. Person — promote rows with legacy `userId` set to claimed-passive.
  //    Skip rows that already have a non-default claimState (idempotency).
  const claimedPersons = await PersonModel.find({
    userId: { $exists: true, $ne: null },
    $or: [
      { claimState: { $exists: false } },
      { claimState: 'unclaimed' },
    ],
  }).select('_id userId createdAt').lean()

  for (const p of claimedPersons) {
    await PersonModel.updateOne(
      { _id: p._id },
      {
        $set: {
          claimState: 'claimed-passive',
          claimedBy: p.userId,
          claimedAt: p.createdAt,
        }
      }
    )
  }
  console.log(`Person: ${claimedPersons.length} legacy-claimed records promoted to claimed-passive`)

  // 3. Person — set provisionally-claimed for those with a pending ClaimRequest.
  const pendingRequests = await ClaimRequestModel.find({ status: 'pending' })
    .select('person target')
    .lean()

  let provisionalCount = 0
  for (const req of pendingRequests) {
    const personId = req.target?.kind === 'person' ? req.target.id : req.person
    if (!personId) continue
    const result = await PersonModel.updateOne(
      { _id: personId, claimState: { $in: ['unclaimed'] } },
      { $set: { claimState: 'provisionally-claimed' } }
    )
    if (result.modifiedCount > 0) provisionalCount++
  }
  console.log(`Person: ${provisionalCount} records transitioned to provisionally-claimed (pending requests)`)

  // 4. ClaimRequest — backfill polymorphic `target` from legacy `person` field.
  const legacyRequests = await ClaimRequestModel.find({
    person: { $exists: true, $ne: null },
    'target.kind': { $exists: false },
  }).select('_id person').lean()

  for (const req of legacyRequests) {
    await ClaimRequestModel.updateOne(
      { _id: req._id },
      {
        $set: {
          target: { kind: 'person', id: req.person },
        }
      }
    )
  }
  console.log(`ClaimRequest: ${legacyRequests.length} records backfilled with polymorphic target\n`)

  await printCounts('After')

  await disconnectFromDatabase()
  console.log('\nDone.')
}

async function printCounts(label: string) {
  const venueByState = await VenueModel.aggregate([
    { $group: { _id: '$claimState', count: { $sum: 1 } } }
  ])
  const companyByState = await ProductionCompanyModel.aggregate([
    { $group: { _id: '$claimState', count: { $sum: 1 } } }
  ])
  const personByState = await PersonModel.aggregate([
    { $group: { _id: '$claimState', count: { $sum: 1 } } }
  ])
  const claimRequestsByTargetKind = await ClaimRequestModel.aggregate([
    { $group: { _id: '$target.kind', count: { $sum: 1 } } }
  ])

  console.log(`--- ${label} ---`)
  console.log('Venue claimState:', venueByState)
  console.log('ProductionCompany claimState:', companyByState)
  console.log('Person claimState:', personByState)
  console.log('ClaimRequest target.kind:', claimRequestsByTargetKind)
}

main()
  .catch((err) => {
    console.error('backfillClaimState failed:', err)
    process.exit(1)
  })
