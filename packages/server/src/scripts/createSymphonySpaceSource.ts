import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 1 (JSON-LD) — Symphony Space, UWS Manhattan.
// probeSeedList found 1 TheaterEvent at /events — weak signal (single-event
// page at probe time). Two stages: Peter Jay Sharp Theatre and Leonard Nimoy
// Thalia. Programs theater, film, music, and literary events.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.symphonyspace.org/events',
  strategy: { mode: 'json-ld' },
  rowDefaults: {
    venueName: 'Symphony Space',
    venueAddress: '2537 Broadway',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10025'
  }
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found')

    const existing = await DataSourceModel.findOne({ type: 'scraper', url: CONFIG.startUrl })
    if (existing) {
      existing.name = 'Symphony Space (symphonyspace.org)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Symphony Space DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /symphony space/i } })

    const ds = await DataSourceModel.create({
      name: 'Symphony Space (symphonyspace.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Symphony Space DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
