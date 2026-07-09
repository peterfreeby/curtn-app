import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Catalina Bar & Grill / Catalina Jazz Club (catalinajazzclub.com) — Hollywood
// jazz + cabaret supper club, nightly bills. The /calendar (TicketWeb-powered,
// Playwright-rendered) lists `.tw-cal-event` rows: `.tw-name` (artist/show title),
// `.tw-event-date` ("Jun 6", year-less → date transform infers it), and a
// `.tw-image` link to the /tm-event/<slug> page. Detail pages carry the TicketWeb
// og:image flyer, the show time (`.tw-event-time-complete`), and a rich
// og:description synopsis (contra the earlier note — the /tm-event pages DO carry
// a prose blurb per show), which we pull for showDescription.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://catalinajazzclub.com/calendar',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.tw-cal-event',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.tw-name', transform: 'trim' },
            { type: 'field', id: 'date', csvField: 'date', selector: '.tw-event-date', transform: 'date' },
            // .tw-image is a div wrapping the <a> (link) and <img> (TicketWeb flyer).
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: '.tw-image img', attribute: 'src', transform: 'trim' },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: '.tw-image a', attribute: 'href', transform: 'trim' },
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: '.tw-image a', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Catalina Bar & Grill',
    venueAddress: '6725 Sunset Blvd',
    venueCity: 'Los Angeles',
    venueState: 'CA',
    venueZipCode: '90028',
    performanceTypes: 'cabaret'
  },
  maxItems: 60,
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
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'meta[property="og:image"], meta[name="og:image"]',
              attribute: 'content',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: '.tw-event-time-complete, .tw-event-time',
              regex: '(\\d{1,2}:\\d{2}\\s*[APap][Mm])',
              transform: 'time'
            },
            {
              type: 'field',
              id: 'description',
              csvField: 'showDescription',
              selector: 'meta[property="og:description"], meta[name="og:description"]',
              attribute: 'content',
              transform: 'trim'
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
    if (!admin) throw new Error('No admin user found — run setAdmin first')

    const existing = await DataSourceModel.findOne({ type: 'scraper', url: CONFIG.startUrl })
    if (existing) {
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Catalina DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /catalina/i } })

    const ds = await DataSourceModel.create({
      name: 'Catalina Bar & Grill (catalinajazzclub.com)',
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
    console.log('Created Catalina DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
