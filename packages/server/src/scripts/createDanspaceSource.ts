import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) + detail-follow — Danspace Project, St. Mark's Church.
// /calendar links shows at /calendar/<slug>. No JSON-LD / og:image, but the
// detail page has clean hooks: <title> ("Show – Danspace Project"), poster
// img.attachment-large (a wp-content production photo), time .event-time ("8PM"),
// and the run dates in body text ("July 2–11, 2026"). Description prose is in
// class-less <p>s with no stable selector, so it's omitted rather than mis-grabbed.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://danspaceproject.org/calendar/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          // Real events are /calendar/<slug>/; exclude the month-nav links
          // (/calendar/?event-month=...).
          selector: 'a[href*="/calendar/"]:not([href*="?"])',
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
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Detail',
          selector: 'html',
          children: [
            {
              // <title> "Dorrance Dance: SOUNDspace – Danspace Project"
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'title',
              regex: '^\\s*([^\\u2013|]+?)\\s*(?:[\\u2013|]|$)',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'img.attachment-large',
              attribute: 'src',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: '.event-time',
              regex: '(\\d{1,2}(?::\\d{2})?\\s*[AP]M)',
              transform: 'time'
            },
            {
              // Run dates in body: "July 2–11, 2026" — capture the start
              // month+day (year-less, inferred). Optional outer group -> '' on miss.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: 'body',
              regex: '^(?:[\\s\\S]*?((?:January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2}))',
              transform: 'date'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Danspace Project',
    venueAddress: '131 East 10th Street',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10003',
    performanceTypes: 'dance'
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
      existing.name = 'Danspace Project (danspaceproject.org)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Danspace Project DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /danspace/i } })

    const ds = await DataSourceModel.create({
      name: 'Danspace Project (danspaceproject.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Danspace Project DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Danspace Project venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
