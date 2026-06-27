import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Club Cumming (clubcummingnyc.com), East Village — queer cabaret bar. Squarespace
// Events collection surfaced via summary blocks on the homepage. Each .summary-item
// carries title (.summary-title-link), a clean date (.summary-metadata-item,
// "June 4, 2026"), a real poster (.summary-thumbnail-image), and a link to the
// /schedule/<slug> event page (.summary-thumbnail-container). It's a free/at-the-
// door bar with no online ticketing, so the canonical /schedule event page is the
// ticketUrl. Detail fetch pulls the og:description synopsis.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.clubcummingnyc.com/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.summary-item',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.summary-title-link', transform: 'trim' },
            { type: 'field', id: 'date', csvField: 'date', selector: '.summary-metadata-item', transform: 'date' },
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: '.summary-thumbnail-image', attribute: 'src', transform: 'trim' },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: '.summary-thumbnail-container', attribute: 'href', transform: 'trim' },
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: '.summary-thumbnail-container', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Club Cumming',
    venueAddress: '505 E 6th St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10009',
    performanceTypes: 'cabaret'
  },
  maxItems: 60,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title', 'date'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Event detail',
          selector: 'html',
          children: [
            { type: 'field', id: 'desc', csvField: 'showDescription', selector: 'meta[property="og:description"]', attribute: 'content', transform: 'trim' }
          ]
        }
      ]
    }
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
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Club Cumming DataSource:', existing._id.toString())
      return
    }
    const venue = await VenueModel.findOne({ name: { $regex: /club cumming/i } })
    const ds = await DataSourceModel.create({
      name: 'Club Cumming (clubcummingnyc.com)',
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
    console.log('Created Club Cumming DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
