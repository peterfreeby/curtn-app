import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 1 (JSON-LD) — Dolby Theatre, Hollywood (Oscars venue + occasional theater).
// probeSeedList found 16 Events on /events/. Dolby programs Broadway national
// tours alongside other events; filter by performing arts context at review time.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://dolbytheatre.com/events/',
  strategy: { mode: 'json-ld' },
  rowDefaults: {
    venueName: 'Dolby Theatre',
    venueAddress: '6801 Hollywood Blvd',
    venueCity: 'Hollywood',
    venueState: 'CA',
    venueZipCode: '90028'
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
      existing.name = 'Dolby Theatre (dolbytheatre.com)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Dolby Theatre DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /dolby theatre/i } })

    const ds = await DataSourceModel.create({
      name: 'Dolby Theatre (dolbytheatre.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Dolby Theatre DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
