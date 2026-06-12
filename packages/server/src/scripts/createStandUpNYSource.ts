import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) + SPA detail-follow — Stand Up NY, Upper West Side.
// The site embeds a VenuePilot Vue widget. /upcoming-shows lists ~13
// .vp-event-card tiles, each carrying title (.vp-event-name), date (.vp-date,
// year-less), time (.vp-time), poster (background-image on .vp-cover-img), and
// a link to the in-widget event route (#/events/<id>) used as the ticket URL.
// The card has no description, but loading the #/events/<id> hash route renders
// the full detail client-side, exposing .vp-event-description — so we
// detail-follow it for the description.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.standupny.com/upcoming-shows/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.vp-event-card',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.vp-event-name',
              transform: 'trim'
            },
            {
              // "Wed Jun 10" — strip the weekday so new Date() parses the
              // month/day; year-less, so the date transform infers the year.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '.vp-date',
              regex: '([A-Z][a-z]{2}\\s+\\d{1,2})\\s*$',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: '.vp-time',
              transform: 'time'
            },
            {
              // Poster lives in a background-image style on the cover div.
              type: 'field',
              id: 'image',
              csvField: 'showImageUrl',
              selector: '.vp-cover-img',
              attribute: 'style',
              regex: 'url\\(["\']?([^"\')]+)',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a.vp-event-link',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a.vp-event-link',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
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
          selector: 'body',
          children: [
            {
              type: 'field',
              id: 'fullDescription',
              csvField: 'showDescription',
              selector: '.vp-event-description',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  cleanup: {
    // The detail block leads with a "Description" heading label.
    descriptionStripPatterns: ['^\\s*Description\\s*']
  },
  rowDefaults: {
    venueName: 'Stand Up NY',
    venueAddress: '236 West 78th St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10024',
    performanceTypes: 'comedy'
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
      existing.name = 'Stand Up NY (standupny.com)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Stand Up NY DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /stand up ny/i } })

    const ds = await DataSourceModel.create({
      name: 'Stand Up NY (standupny.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Stand Up NY DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Stand Up NY venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
