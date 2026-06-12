import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template, listing-only) — The Stand, Union Square.
// /shows lists ~20 .show_row cards. The desktop .showinfo carries two
// .show_date spans — [0] the date ("June 6", year-less) and [1] the time
// ("1:00 PM") — plus .list-show-room ("Upstairs"). Title + ticket link come
// from .showtitle a, poster from .show_image img.
// NOTE: the /shows/show/<id>/<date-slug> detail pages sit behind a Cloudflare
// bot-verification challenge, so we can't detail-follow for a description; every
// other field (incl. the lineup, which is baked into the title) comes from the
// listing.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://thestandnyc.com/shows',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.show_row',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.showtitle',
              transform: 'trim'
            },
            {
              // First .show_date span = date ("June 6"); year-less, inferred.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '.show_date',
              transform: 'date'
            },
            {
              // Second .show_date span = time ("1:00 PM").
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: '.show_date',
              index: 1,
              // The time span's malformed markup swallows the trailing room name
              // ("1:00 PM Upstairs") — pull just the time.
              regex: '(\\d{1,2}:\\d{2}\\s*[AP]M)',
              transform: 'time'
            },
            {
              type: 'field',
              id: 'image',
              csvField: 'showImageUrl',
              selector: '.show_image img',
              attribute: 'src',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: '.showtitle a',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'The Stand',
    venueAddress: '116 East 16th Street',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10003',
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
      existing.name = 'The Stand (thestandnyc.com)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated The Stand DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /the stand/i } })

    const ds = await DataSourceModel.create({
      name: 'The Stand (thestandnyc.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created The Stand DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing The Stand venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
