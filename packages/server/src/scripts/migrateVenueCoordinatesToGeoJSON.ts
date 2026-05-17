/**
 * One-time migration: converts venue coordinates from the legacy {lat, lng}
 * flat format to GeoJSON Point {type: 'Point', coordinates: [lng, lat]}.
 *
 * Run once per environment after deploying the schema change:
 *   npx ts-node -e "require('./migrateVenueCoordinatesToGeoJSON')"
 * Or via the existing script runner pattern in this project.
 *
 * Safe to re-run — skips venues that already have a `location` field.
 *
 * After running, manually ensure the 2dsphere index on each deployed DB:
 *   db.venues.createIndex({ location: "2dsphere" })
 */

import '../config/env'
import mongoose from 'mongoose'

const MONGO_URI = process.env.MONGODB_URL
if (!MONGO_URI) {
  console.error('MONGODB_URL not set')
  process.exit(1)
}

async function migrate() {
  await mongoose.connect(MONGO_URI!)
  console.log('Connected to MongoDB')

  const db = mongoose.connection.db!
  const venues = db.collection('venues')

  // Find venues that still have the old flat coordinates but no GeoJSON location
  const cursor = venues.find({
    'coordinates.lat': { $exists: true },
    location: { $exists: false }
  })

  let migrated = 0
  let skipped = 0

  for await (const venue of cursor) {
    const lat = venue.coordinates?.lat
    const lng = venue.coordinates?.lng

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      skipped++
      continue
    }

    await venues.updateOne(
      { _id: venue._id },
      {
        $set: { location: { type: 'Point', coordinates: [lng, lat] } },
        $unset: { coordinates: '' }
      }
    )
    migrated++
  }

  console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped (missing lat/lng)`)
  await mongoose.disconnect()
}

migrate().catch(err => {
  console.error(err)
  process.exit(1)
})
