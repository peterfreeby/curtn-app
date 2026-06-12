import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) + JSON-LD detail-follow — West Side Comedy Club, UWS NYC.
// (Distinct from the LA "Westside Comedy Theater" — different venue/site.)
// The homepage links each show at /shows/<slug>. Those detail pages carry a
// schema.org TheaterEvent JSON-LD (name/startDate+time/endDate/description) but
// no image/offers, so we layer the poster from og:image over the JSON-LD base
// (Hennepin pattern). The show page URL doubles as the ticket link.
// TheaterEvent maps to 'theater', so we force performanceTypes 'comedy'.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.westsidecomedyclub.com/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: 'a[href*="/shows/"]',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: ':scope',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: ':scope',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: ':scope',
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
    fingerprint: ['title'],
    jsonLd: true, // name/startDate(date+time)/description from the TheaterEvent JSON-LD
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Poster',
          selector: 'html',
          children: [
            {
              // JSON-LD has no image; pull the per-show poster from og:image.
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'meta[property="og:image"]',
              attribute: 'content',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'West Side Comedy Club',
    venueAddress: '201 West 75th Street',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10023',
    performanceTypes: 'comedy'
  },
  maxItems: 40
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
      existing.name = 'West Side Comedy Club (westsidecomedyclub.com)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated West Side Comedy Club DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /west side comedy club/i } })

    const ds = await DataSourceModel.create({
      name: 'West Side Comedy Club (westsidecomedyclub.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created West Side Comedy Club DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing West Side Comedy Club venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
