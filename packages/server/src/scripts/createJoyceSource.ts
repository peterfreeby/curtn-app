import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — The Joyce Theater, Chelsea NYC.
// Container: .eventCard ×8 on /performances. Same Spektrix-based CMS as
// Queens Theatre. Run dates in h4.top-date ("WED MAY 13 - SUN MAY 17").
// Detail URL is relative — engine resolves against startUrl.
// tagline field maps to showDescription (short blurb on listing card).

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.joyce.org/performances',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.eventCard',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h3.title',
              transform: 'trim'
            },
            {
              // "WED MAY 13 - SUN MAY 17" — stored raw as runStartDate.
              // Admin splits into runStartDate + runEndDate at review.
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: '.top-date',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showDescription',
              csvField: 'showDescription',
              selector: '.tagline',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="/performances/"]',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showImageUrl',
              csvField: 'showImageUrl',
              selector: 'img',
              attribute: 'src',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'The Joyce Theater',
    venueAddress: '175 8th Ave',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10011'
  },
  maxItems: 30
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
      existing.name = 'The Joyce Theater (joyce.org)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Joyce Theater DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /joyce theater/i } })

    const ds = await DataSourceModel.create({
      name: 'The Joyce Theater (joyce.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Joyce Theater DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Joyce Theater venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
