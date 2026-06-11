import '../config/env'
import mongoose from 'mongoose'
import { VenueModel } from '../entities/venue/venueModel'
import { GeocodingJobModel } from '../entities/geocodingJob/geocodingJobModel'

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  // 1. Queue-wide stats
  const byStatus = await GeocodingJobModel.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ])
  console.log('\n=== Geocoding job counts by status ===')
  console.log(byStatus)

  // Stuck 'processing' jobs (no reaper exists — these are orphaned)
  const stuck = await GeocodingJobModel.find({ status: 'processing' })
    .select('venueId attemptCount lastAttemptAt lastError').lean()
  console.log(`\n=== Stuck 'processing' jobs: ${stuck.length} ===`)
  stuck.slice(0, 20).forEach(j => console.log(`  venue=${j.venueId} attempts=${j.attemptCount} lastAttempt=${(j as any).lastAttemptAt} err=${j.lastError}`))

  // Failed jobs
  const failed = await GeocodingJobModel.find({ status: 'failed' })
    .select('venueId attemptCount lastError').lean()
  console.log(`\n=== Failed jobs: ${failed.length} ===`)
  failed.slice(0, 30).forEach(j => console.log(`  venue=${j.venueId} attempts=${j.attemptCount} err=${j.lastError}`))

  // Pending that are due now vs scheduled later
  const now = new Date()
  const dueNow = await GeocodingJobModel.countDocuments({ status: 'pending', nextAttemptAt: { $lte: now } })
  const scheduled = await GeocodingJobModel.countDocuments({ status: 'pending', nextAttemptAt: { $gt: now } })
  console.log(`\n=== Pending: dueNow=${dueNow} scheduledLater=${scheduled} ===`)

  // 2. Long Beach Playhouse specifically
  console.log('\n=== Long Beach Playhouse ===')
  const venues = await VenueModel.find({ name: /long beach/i })
    .select('name address city state zipCode location updatedAt').lean()
  for (const v of venues) {
    console.log(`\nvenue ${v._id}: "${v.name}"`)
    console.log(`  address="${v.address ?? ''}" city="${v.city ?? ''}" state="${v.state ?? ''}" zip="${v.zipCode ?? ''}"`)
    console.log(`  location=${JSON.stringify(v.location)}`)
    console.log(`  updatedAt=${(v as any).updatedAt}`)
    const jobs = await GeocodingJobModel.find({ venueId: v._id })
      .select('status attemptCount nextAttemptAt lastError addressSnapshot completedAt').lean()
    if (!jobs.length) {
      console.log(`  >>> NO geocoding job exists for this venue <<<`)
    }
    jobs.forEach(j => console.log(`  job ${j._id}: status=${j.status} attempts=${j.attemptCount} next=${(j as any).nextAttemptAt} snapshot=${JSON.stringify(j.addressSnapshot)} err=${j.lastError}`))
  }

  // 3. Venues with a street address but no location (the real backlog)
  const missingLoc = await VenueModel.countDocuments({
    address: { $exists: true, $nin: ['', null] },
    location: { $exists: false }
  })
  console.log(`\n=== Venues with street address but NO location field: ${missingLoc} ===`)

  await mongoose.disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
