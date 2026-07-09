import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Westside Comedy Theater (westsidecomedy.com) — Santa Monica. Shows are pulled
// from Eventbrite via the WP Event Aggregator plugin, rendered (after JS) as
// `.wfea-card-list-item` cards: a `.eaw-calendar-date` ("JUN 6", year-less → date
// transform infers it), `.eaw-title`, a `.published` line ("Sat 8:00pm" → regex the
// time), an `.eaw-summary` blurb, the Eventbrite flyer (`.entered`/img, img.evbuc.com),
// and a `.eaw-img` link to the local single-event page (ticket/info).
// Poster: img.eaw-thumb (Eventbrite CDN, img.evbuc.com). The old `.entered`
// lazy-load class never fires in headless, so posters staged empty.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://westsidecomedy.com/shows',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.wfea-card-list-item',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.eaw-title', transform: 'trim' },
            { type: 'field', id: 'date', csvField: 'date', selector: '.eaw-calendar-date', transform: 'date' },
            { type: 'field', id: 'time', csvField: 'time', selector: '.published', regex: '(\\d{1,2}:\\d{2}\\s*[APap][Mm])', transform: 'time' },
            { type: 'field', id: 'desc', csvField: 'showDescription', selector: '.eaw-summary', transform: 'trim' },
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: 'img.eaw-thumb', attribute: 'src', transform: 'trim' },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: '.eaw-img', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Westside Comedy Theater',
    venueAddress: '1323-A 3rd Street Promenade',
    venueCity: 'Santa Monica',
    venueState: 'CA',
    venueZipCode: '90401',
    performanceTypes: 'comedy'
  },
  maxItems: 50,
  cleanup: {
    // Trailing category tag the plugin appends, e.g. "… ( Stand-Up Comedy)".
    titleStripPatterns: ['\\s*\\(\\s*stand-?up comedy\\s*\\)\\s*$', '\\s*\\(\\s*improv\\s*\\)\\s*$']
  }
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found — run setAdmin first')

    const existing = await DataSourceModel.findOne({ type: 'scraper', url: CONFIG.startUrl })
    if (existing) {
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Westside Comedy DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /westside comedy/i } })

    const ds = await DataSourceModel.create({
      name: 'Westside Comedy Theater (westsidecomedy.com)',
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
    console.log('Created Westside Comedy DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
