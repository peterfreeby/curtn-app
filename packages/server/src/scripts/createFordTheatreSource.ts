import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// The Ford (theford.com) — John Anson Ford Theatres, Hollywood Hills outdoor
// amphitheater; LA County / LA Phil-presented dance, music, and performance. The
// /events page (Playwright-rendered) lists `.performance-card`s with `.name`
// (title + link to /events/performances/<id>/<date>/<slug>), a `.date-text`
// ("Sun, June 21", year-less → date transform infers it), and `.time` ("7:30PM").
// Detail pages carry og:image and a full og:description, layered on via detail-fetch.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.theford.com/events',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.performance-card',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.name', transform: 'trim' },
            { type: 'field', id: 'date', csvField: 'date', selector: '.date-text', transform: 'date' },
            { type: 'field', id: 'time', csvField: 'time', selector: '.time', transform: 'time' },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: '.name', attribute: 'href', transform: 'trim' },
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: '.name', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'The Ford',
    venueAddress: '2580 Cahuenga Blvd E',
    venueCity: 'Los Angeles',
    venueState: 'CA',
    venueZipCode: '90068'
    // performanceTypes intentionally unset — the Ford mixes dance / music / etc.
  },
  maxItems: 80,
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
      console.log('Updated existing Ford DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /ford (theatre|theater)|the ford/i } })

    const ds = await DataSourceModel.create({
      name: 'The Ford (theford.com)',
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
    console.log('Created Ford DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
