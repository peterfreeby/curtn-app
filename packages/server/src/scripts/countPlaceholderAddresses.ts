import '../config/env'
import mongoose from 'mongoose'
import { VenueModel } from '../entities/venue/venueModel'

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')

  await mongoose.connect(mongoUrl)

  const exactTbdNyc = await VenueModel.countDocuments({ address: 'TBD', city: 'NYC' })
  const caseInsensitiveTbdNyc = await VenueModel.countDocuments({
    address: { $regex: /^tbd$/i },
    city: 'NYC'
  })
  const variantsTbdNyc = await VenueModel.countDocuments({
    address: { $regex: /^t\.?b\.?d\.?$/i },
    city: 'NYC'
  })
  const tbdAnyCity = await VenueModel.countDocuments({
    address: { $regex: /^t\.?b\.?d\.?$/i }
  })

  const sample = await VenueModel.find({
    address: { $regex: /^t\.?b\.?d\.?$/i },
    city: 'NYC'
  })
    .select('name address city state coordinates')
    .limit(10)
    .lean()

  console.log('--- Counts ---')
  console.log(`Exact address="TBD" + city="NYC":              ${exactTbdNyc}`)
  console.log(`Case-insensitive /^tbd$/i + city="NYC":        ${caseInsensitiveTbdNyc}`)
  console.log(`Variants /^t\\.?b\\.?d\\.?$/i + city="NYC":    ${variantsTbdNyc}`)
  console.log(`Variants /^t\\.?b\\.?d\\.?$/i (any city):       ${tbdAnyCity}`)

  console.log('\n--- Sample (variants + NYC, first 10) ---')
  for (const v of sample) {
    console.log(
      `  ${v.name}  |  addr="${v.address}"  city="${v.city}"  state="${v.state}"  coords=${
        v.location ? `${v.location.coordinates[1]},${v.location.coordinates[0]}` : 'none'
      }`
    )
  }

  await mongoose.disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
