import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// St. George Theatre (stgeorgetheatre.com) — WordPress, single-level scrape.
//
// The homepage renders an `.event-box` (".slide") per upcoming event with:
//   .event-date    day/date/month spans → text "Thu 4 Jun" (no year; regex pulls
//                  "4 Jun", date transform infers the current year)
//   .event-image img   poster
//   .event-content h3 a  title + link → /events/<slug>/
//   .event-content p   inline description/synopsis
//
// Notes:
//  - Historic Staten Island performing-arts house — concerts, comedy, tribute acts,
//    film screenings, Philharmonic. performanceTypes defaults to 'theater'.
//  - Detail pages expose only generic Box Office / How-to-Buy links (no per-show
//    purchase URL), so ticketUrl = the canonical /events/<slug>/ show page.

const ST_GEORGE_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.stgeorgetheatre.com/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.event-box',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.event-content h3 a',
              transform: 'trim'
            },
            {
              // "Thu 4 Jun" → pull "4 Jun"; date transform infers current year.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '.event-date',
              regex: '(\\d{1,2}\\s+[A-Za-z]{3,})',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'description',
              csvField: 'showDescription',
              selector: '.event-content p',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: '.event-image img',
              attribute: 'src',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: '.event-content h3 a',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'St. George Theatre',
    venueAddress: '35 Hyatt Street',
    venueCity: 'Staten Island',
    venueState: 'NY',
    venueZipCode: '10301',
    performanceTypes: 'theater'
  },
  maxItems: 40
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found — run setAdmin first')

    const existing = await DataSourceModel.findOne({
      type: 'scraper',
      url: ST_GEORGE_CONFIG.startUrl
    })
    if (existing) {
      existing.config = ST_GEORGE_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing St. George DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /st\.?\s*george\s*theatre/i } })

    const ds = await DataSourceModel.create({
      name: 'St. George Theatre (stgeorgetheatre.com)',
      type: 'scraper',
      url: ST_GEORGE_CONFIG.startUrl,
      config: ST_GEORGE_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created St. George DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing St. George venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
