import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) + JSON-LD detail-follow — Gotham Comedy Club, Chelsea.
// The /calendar page (custom LeapEvents calendar) lists each show as a
// .events-event-detail row carrying the title, poster, and one or more
// .events-event-detail-time-show blocks (one per showtime), each with a
// "Get Tickets" button linking to events.leapevents.com/event/<slug>.
// The calendar itself has no per-event date (FullCalendar background grid is a
// separate DOM layer), BUT every LeapEvents ticket page carries a complete
// schema.org Event JSON-LD (name/startDate+time/endDate/image/description), so
// we fan out one row per showtime, capture the LeapEvents URL as both the
// ticket link and the detail URL, and let jsonLd:true fill date/time/desc/image.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.gothamcomedyclub.com/calendar',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.events-event-detail',
          children: [
            {
              // Provisional title for the detail fingerprint; the JSON-LD name
              // overrides it on the final row.
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.events-event-detail-title',
              transform: 'trim'
            },
            {
              // One nested row per showtime (6:00/8:00/10:30pm), each inheriting
              // the parent title and carrying its own LeapEvents ticket URL.
              type: 'container',
              id: 'showtimes',
              label: 'Showtimes',
              selector: '.events-event-detail-time-show',
              children: [
                {
                  type: 'field',
                  id: 'detailUrl',
                  csvField: '_detailUrl',
                  selector: '.events-event-detail-time-button',
                  attribute: 'href',
                  transform: 'trim'
                },
                {
                  type: 'field',
                  id: 'ticketUrl',
                  csvField: 'ticketUrl',
                  selector: '.events-event-detail-time-button',
                  attribute: 'href',
                  transform: 'trim'
                }
              ]
            }
          ]
        }
      ]
    }
  },
  detail: {
    fromField: '_detailUrl',
    // detailUrl is unique per showtime, so it keys the cache even though the
    // title repeats across the nightly recurring showcases.
    fingerprint: ['title'],
    jsonLd: true // name/startDate(date+time)/image/description from the Event JSON-LD
  },
  rowDefaults: {
    venueName: 'Gotham Comedy Club',
    venueAddress: '208 West 23rd St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10011',
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
      existing.name = 'Gotham Comedy Club (gothamcomedyclub.com)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Gotham Comedy Club DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /gotham comedy/i } })

    const ds = await DataSourceModel.create({
      name: 'Gotham Comedy Club (gothamcomedyclub.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Gotham Comedy Club DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Gotham Comedy Club venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
