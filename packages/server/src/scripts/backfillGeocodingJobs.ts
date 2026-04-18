import '../config/env'
import mongoose from 'mongoose'
import { VenueModel } from '../entities/venue/venueModel'
import { enqueueGeocodingJob } from '../services/geocoding/enqueueGeocodingJob'

// Enqueue geocoding jobs for existing venues that have an address but no
// coordinates (or city-center defaults). Safe to re-run: the enqueue helper
// upserts by venueId + status='pending', so duplicate runs collapse.
async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')

  await mongoose.connect(mongoUrl)

  const dryRun = process.argv.includes('--dry-run')

  const candidates = await VenueModel.find({
    $and: [
      {
        $or: [
          { address: { $exists: true, $ne: '' } },
          { city: { $exists: true, $ne: '' } }
        ]
      },
      {
        $or: [
          { coordinates: { $exists: false } },
          { 'coordinates.lat': { $exists: false } },
          { 'coordinates.lng': { $exists: false } },
          // NYC city-center default — known to be wrong for specific venues
          { 'coordinates.lat': 40.7128, 'coordinates.lng': -74.006 }
        ]
      }
    ]
  }).select('_id name address city state zipCode').lean()

  console.log(`Found ${candidates.length} venue(s) needing geocoding`)

  if (dryRun) {
    const sample = candidates.slice(0, 10)
    for (const v of sample) {
      console.log(`  ${v.name}  |  addr="${v.address ?? ''}"  city="${v.city ?? ''}"`)
    }
    console.log('\n(dry-run: no jobs enqueued)')
    await mongoose.disconnect()
    return
  }

  let enqueued = 0
  for (const v of candidates) {
    await enqueueGeocodingJob(v._id, {
      address: v.address,
      city: v.city,
      state: v.state,
      zipCode: v.zipCode
    })
    enqueued++
  }

  console.log(`Enqueued ${enqueued} geocoding job(s)`)
  await mongoose.disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
