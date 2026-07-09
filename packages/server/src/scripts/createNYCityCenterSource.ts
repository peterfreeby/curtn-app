import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// NYC City Center (nycitycenter.org). The public site is fronted by a
// Cloudflare managed challenge ("Just a moment…" / "Verifying your request",
// Ray ID) on every path, with a Queue-it virtual waiting room configured on
// top. This source points at the /calendar listing and follows each event's
// detail page with a fresh browser context + hydration wait — the same unlock
// that cleared St. Ann's Warehouse / Broadway Direct. If the managed challenge
// blocks a real headless context outright, the engine will surface a 403 /
// empty extraction rather than any rows.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.nycitycenter.org/calendar',
  // Wait for the real calendar list to render (never populated behind the
  // challenge). Broad, class-agnostic anchor: the calendar event links.
  waitFor: 'a[href*="/calendar/"], .calendar-event, [class*="event"]',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '[class*="event"], .calendar-event',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: 'h2, h3, .title', transform: 'trim' },
            { type: 'field', id: 'date', csvField: 'date', selector: 'time, .date', transform: 'date' },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a[href*="/calendar/"]',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'New York City Center',
    venueAddress: '131 W 55th St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10019'
  },
  maxItems: 50,
  rehostImages: true,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title', 'date'],
    jsonLd: true,
    // Cloudflare + JS hydration: fresh context per page and wait for real content.
    freshContextPerFetch: true,
    waitForSelector: '[class*="description"], .rich-text, main',
    fillIfEmpty: ['image', 'showImageUrl'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Event detail',
          selector: 'main, [role="main"]',
          children: [
            { type: 'field', id: 'time', csvField: 'time', selector: 'time', transform: 'time' },
            {
              type: 'field',
              id: 'fullDescription',
              csvField: 'showDescription',
              selector: '[class*="description"], .rich-text p',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'img',
              attribute: 'src',
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
      console.log('Updated existing NYC City Center DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /new york city center/i } })

    const ds = await DataSourceModel.create({
      name: 'New York City Center (nycitycenter.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created NYC City Center DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
