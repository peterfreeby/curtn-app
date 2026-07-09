import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 3 (code) — The Bell House, Gowanus (Brooklyn).
// The page's JSON-LD carries title/date/image/ticket-url but NO description,
// and every event links out to Ticketmaster (bot-walled, no venue detail page).
// The real blurb lives in the `important_info` field of the Next.js flight
// payload, which the code scraper decodes. See scrapers/bellHouse.ts.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.thebellhouseny.com/shows',
  strategy: { mode: 'code', scraperId: 'bell-house' }
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
      existing.name = 'The Bell House (thebellhouseny.com)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Bell House DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /bell house/i } })

    const ds = await DataSourceModel.create({
      name: 'The Bell House (thebellhouseny.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Bell House DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
