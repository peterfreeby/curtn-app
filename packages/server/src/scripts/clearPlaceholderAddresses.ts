import '../config/env'
import mongoose from 'mongoose'
import { VenueModel } from '../entities/venue/venueModel'

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')

  await mongoose.connect(mongoUrl)

  const filter = { address: 'TBD', city: 'NYC' }
  const before = await VenueModel.countDocuments(filter)
  console.log(`Matched ${before} venue(s) with address="TBD" and city="NYC"`)

  if (before === 0) {
    await mongoose.disconnect()
    return
  }

  const result = await VenueModel.updateMany(filter, {
    $unset: { address: '', coordinates: '' }
  })

  console.log(`Matched: ${result.matchedCount}  Modified: ${result.modifiedCount}`)

  const remaining = await VenueModel.countDocuments(filter)
  console.log(`Remaining matches after update: ${remaining}`)

  await mongoose.disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
