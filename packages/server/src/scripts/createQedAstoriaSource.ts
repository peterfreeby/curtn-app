import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) + detail-follow — Q.E.D., Astoria (lit + comedy).
// Shopify store; shows are products. The events app at /apps/events/calendar
// renders a FullCalendar whose .fc-event anchors link to
// /products/<slug>?event=<ISO datetime> — so date AND time come straight off the
// href query (unambiguous), and the leading anchor text is the showtime + title.
// Each product page carries clean og:title / og:image (Shopify CDN poster) /
// og:description, fetched via detail-follow.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://qedastoria.com/apps/events/calendar',
  // FullCalendar hydrates the .fc-event anchors client-side; without waiting for
  // them the listing extracts 0 rows (they aren't in the initial DOM). Wait for
  // the first event cell to render before extracting.
  waitFor: '.fc-event',
  // Shopify CDN posters (og:image) are hotlink-protected and render broken
  // cross-origin on Curtn — download + re-host to R2 (was image_hosting_error).
  rehostImages: true,
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: 'a[href*="?event="]',
          children: [
            {
              // Anchor text is "5:30pHeckling Hand - Comedy for a Cause" — strip
              // the leading showtime. Provisional; detail og:title overrides.
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: ':scope',
              regex: '^(?:\\d{1,2}(?::\\d{2})?[ap]m?)?\\s*(.+)$',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: ':scope',
              attribute: 'href',
              regex: 'event=(\\d{4}-\\d{2}-\\d{2})',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: ':scope',
              attribute: 'href',
              regex: 'event=\\d{4}-\\d{2}-\\d{2}T(\\d{2}:\\d{2})',
              transform: 'time'
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
    fingerprint: ['title', 'date'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Product detail',
          selector: 'html',
          children: [
            {
              type: 'field',
              id: 'ogTitle',
              csvField: 'title',
              selector: 'meta[property="og:title"]',
              attribute: 'content',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ogImage',
              csvField: 'showImageUrl',
              selector: 'meta[property="og:image"]',
              attribute: 'content',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ogDesc',
              csvField: 'showDescription',
              selector: 'meta[property="og:description"]',
              attribute: 'content',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Q.E.D.',
    venueAddress: '27-16 23rd Avenue',
    venueCity: 'Astoria',
    venueState: 'NY',
    venueZipCode: '11105',
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
      existing.name = 'Q.E.D. Astoria (qedastoria.com)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Q.E.D. DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /q\.?e\.?d\.?/i } })

    const ds = await DataSourceModel.create({
      name: 'Q.E.D. Astoria (qedastoria.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Q.E.D. DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Q.E.D. venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
