import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) + detail-follow — The Stand, Union Square.
// /shows lists ~20 .show_row cards. The desktop .showinfo carries two
// .show_date spans — [0] the date ("June 6", year-less) and [1] the time
// ("1:00 PM") — plus .list-show-room ("Upstairs"). Title + ticket link come
// from .showtitle a, poster from .show_image img.
//
// Cloudflare note (corrected): the site challenges the DEFAULT headless-Chrome
// UA but PASSES our honest CurtnBot USER_AGENT (which the orchestrator uses), so
// the detail pages ARE reachable. We detail-follow for the description: showcase/
// lineup shows render a .tab-content of .lineup-item cards (each a performer +
// bio) — we take .tab-content as the description and fan the .lineup-item names
// out as cast. Headliner one-offs (e.g. Oz Pearlman) render neither, so they
// keep an empty description (the act's name is already in the listing title).
// freshContextPerFetch sidesteps Cloudflare's sequential-request degradation;
// waitForSelector('.show_row') waits past the challenge before extracting.

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
            },
            {
              // Same link drives the description/cast detail-fetch.
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
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
  maxItems: 30,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title', 'date'],
    // Honest UA passes Cloudflare, but a fresh context per fetch avoids the
    // sequential-request degradation; wait for the content wrapper to clear the
    // challenge before extracting.
    freshContextPerFetch: true,
    waitForSelector: '.show_row',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Show detail',
          selector: '.tab-content',
          children: [
            {
              // The lineup card stack (performer names + bios) is the de-facto
              // show description. Absent on headliner one-offs → empty.
              type: 'field',
              id: 'description',
              csvField: 'showDescription',
              selector: ':scope',
              transform: 'trim'
            },
            {
              // One row per performer → grouped into the cast array on staging.
              type: 'container',
              id: 'lineup',
              label: 'Lineup',
              selector: '.lineup-item',
              children: [
                {
                  type: 'field',
                  id: 'personName',
                  csvField: 'personName',
                  selector: 'h4',
                  transform: 'trim'
                },
                {
                  type: 'field',
                  id: 'personHeadshotUrl',
                  csvField: 'personHeadshotUrl',
                  selector: 'img',
                  attribute: 'src',
                  transform: 'trim'
                }
              ]
            }
          ]
        }
      ]
    }
  }
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
