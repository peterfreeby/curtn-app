import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Highways Performance Space (highwaysperformance.org) — Santa Monica; experimental
// performance / dance. Wix site (hashed CSS classes, no usable DOM selectors), BUT
// each event page emits a complete schema.org Event JSON-LD (name, description,
// startDate, location, offers, image), so a Tier-1 json-ld strategy reads it
// directly and ignores the markup churn. The /events page currently surfaces the
// active production; the extractor picks up however many Event blocks are present.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://highwaysperformance.org/events',
  strategy: { mode: 'json-ld' },
  rowDefaults: {
    venueName: 'Highways Performance Space',
    venueAddress: '1651 18th St',
    venueCity: 'Santa Monica',
    venueState: 'CA',
    venueZipCode: '90404',
    performanceTypes: 'experimental'
  },
  maxItems: 40
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found — run setAdmin first')

    const existing = await DataSourceModel.findOne({ type: 'scraper', url: CONFIG.startUrl })
    if (existing) {
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Highways DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /highways/i } })

    const ds = await DataSourceModel.create({
      name: 'Highways Performance Space (highwaysperformance.org)',
      type: 'scraper',
      purpose: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Highways DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
