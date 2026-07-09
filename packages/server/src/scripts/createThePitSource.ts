import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — The PIT (Peoples Improv Theater), Chelsea NYC.
// Container: article.mc_event (~108 total, mix of shows, jams, and open mics).
// Title split across prefix (.event-title.prefix), main (.title span), and suffix
// (.event-title.suffix) — capturing just span.title gives the clean show name.
// Dates in h4.dates ("FRIDAY 5/15 – FRIDAY 6/26" with en dash) — stored raw.
// maxItems: 30 limits the firehose; jams/mics will be mixed in but are valid
// performance content for The PIT.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://thepit-nyc.com/events/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: 'article.mc_event',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'span.title',
              transform: 'trim'
            },
            {
              // Raw "FRIDAY 5/15 – FRIDAY 6/26" — stored as runStartDate.
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: 'h4.dates',
              transform: 'trim'
            },
            {
              // The blurb lives in div.entry-summary (the first <p> is often
              // empty, so selecting bare 'p' missed it). Its text trails the
              // "Buy Tickets / Learn More" button labels, stripped via cleanup.
              // The detail og:description overrides this with the fuller copy
              // where the event has its own MEC page; shows whose button links
              // straight to Salesforce ticketing keep this listing blurb.
              type: 'field',
              id: 'showDescription',
              csvField: 'showDescription',
              selector: '.entry-summary',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a.btn',
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
            },
            {
              // The event's own MEC page (also the ticket link). Followed for
              // the full blurb + poster: most listing cards (jams, mics, and
              // many shows) render an EMPTY <p>, so the description lives only
              // on the detail page's og tags.
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a.btn',
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
          label: 'Event detail',
          selector: 'html',
          children: [
            // Full blurb — overrides the (usually empty) listing <p>.
            { type: 'field', id: 'desc', csvField: 'showDescription', selector: 'meta[property="og:description"]', attribute: 'content', transform: 'trim' },
            // Poster — only fills when the listing card had no <img>.
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: 'meta[property="og:image"]', attribute: 'content', transform: 'trim' }
          ]
        }
      ]
    },
    fillIfEmpty: ['showImageUrl']
  },
  cleanup: {
    descriptionStripPatterns: ['\\s*Buy Tickets\\s*Learn More\\s*$', '\\s*Buy Tickets\\s*$', '\\s*Learn More\\s*$']
  },
  rowDefaults: {
    venueName: 'The PIT',
    venueAddress: '123 E 24th St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10010',
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
      existing.name = 'The PIT (thepit-nyc.com)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated The PIT DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /peoples improv|the pit/i } })

    const ds = await DataSourceModel.create({
      name: 'The PIT (thepit-nyc.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created The PIT DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing PIT venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
