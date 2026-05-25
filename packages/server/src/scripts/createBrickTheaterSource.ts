import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — The Brick Theater, Williamsburg Brooklyn.
// Uses The Events Calendar plugin. Container: .type-tribe_events ×6+ on /events/list/.
// Date range in .tribe-event-schedule-details ("May 21 - May 31").
// List view URL used instead of calendar grid view (/events/ defaults to grid).

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.bricktheater.com/events/list/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.type-tribe_events',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h3.tribe-events-list-event-title',
              transform: 'trim'
            },
            {
              // "May 21 - May 31" — stored raw, admin splits at review.
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: '.tribe-event-schedule-details',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showDescription',
              csvField: 'showDescription',
              selector: '.tribe-events-list-event-description p',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a.tribe-event-url',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showImageUrl',
              csvField: 'showImageUrl',
              selector: 'img.wp-post-image',
              attribute: 'src',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'The Brick Theater',
    venueAddress: '575 Metropolitan Ave',
    venueCity: 'Brooklyn',
    venueState: 'NY',
    venueZipCode: '11211'
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
      existing.name = 'The Brick Theater (bricktheater.com)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Brick Theater DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /brick theater/i } })

    const ds = await DataSourceModel.create({
      name: 'The Brick Theater (bricktheater.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Brick Theater DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Brick Theater venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
