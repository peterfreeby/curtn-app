import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 1 (JSON-LD) — New York Comedy Club.
// The homepage embeds ~21 schema.org ComedyEvent blocks with
// name/startDate(date+time)/location/offers(url+price)/url/image/description.
// location.name varies per show (241 E 24th "New York Comedy Club", 85 E 4th
// "New York Comedy Club on 4th Street", Midtown), so the JSON-LD venue wins over
// the rowDefault fallback. ComedyEvent maps to performanceType 'comedy'
// automatically; offers.url provides the ticket link.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://newyorkcomedyclub.com/',
  strategy: { mode: 'json-ld' },
  rowDefaults: {
    venueName: 'New York Comedy Club',
    venueAddress: '241 East 24th Street',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10010',
    performanceTypes: 'comedy'
  },
  // Each ComedyEvent fans out one row per performer (cast), so allow headroom
  // to capture every show's full lineup before staging groups them.
  maxItems: 150
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
      existing.name = 'New York Comedy Club (newyorkcomedyclub.com)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated New York Comedy Club DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /new york comedy club/i } })

    const ds = await DataSourceModel.create({
      name: 'New York Comedy Club (newyorkcomedyclub.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created New York Comedy Club DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing New York Comedy Club venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
