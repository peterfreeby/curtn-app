import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// The Comedy Store (thecomedystore.com) — Sunset Strip; flagship year-round LA
// stand-up across three rooms (Main / Original / Belly). The /calendar is a JS app
// that Playwright hydrates into `.show_row` cards. Each card carries the show
// flyer (`.show_image img`, a protocol-relative S3 URL the URL resolver absolutizes),
// the title + a detail link whose slug encodes the ISO date
// (`/calendar/show/<id>/2026-06-06t190000-0700-...`), the showtime in the card
// text ("June 6 | 7:00 PM"), and a comedian lineup (`.lineup-item`) we fan out as
// cast (personName + headshot) — the substance of a stand-up bill. Comedy shows
// expose no prose synopsis, so showDescription is intentionally omitted; the
// lineup is the credits the quality bar asks for "where the site exposes them".

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://thecomedystore.com/calendar',
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
            { type: 'field', id: 'title', csvField: 'title', selector: '.show-title a', transform: 'trim' },
            // Date from the detail-link slug (2026-06-06t190000-0700).
            { type: 'field', id: 'date', csvField: 'date', selector: '.show-title a', attribute: 'href', regex: '(\\d{4}-\\d{2}-\\d{2})', transform: 'date' },
            // Showtime from the card text ("… June 6 | 7:00 PM …").
            { type: 'field', id: 'time', csvField: 'time', selector: ':self', regex: '(\\d{1,2}:\\d{2}\\s*[APap][Mm])', transform: 'time' },
            { type: 'field', id: 'stage', csvField: 'stageName', selector: ':self', regex: '(Main Room|Original Room|Belly Room)', transform: 'trim' },
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: '.show_image img', attribute: 'src', transform: 'trim' },
            // Detail/info page (also the click-through to tickets).
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: '.show-title a', attribute: 'href', transform: 'trim' },
            {
              type: 'container',
              id: 'lineup',
              label: 'Lineup',
              selector: '.lineup-item',
              children: [
                { type: 'field', id: 'personName', csvField: 'personName', selector: 'a', transform: 'trim' },
                { type: 'field', id: 'headshot', csvField: 'personHeadshotUrl', selector: 'img', attribute: 'src', transform: 'trim' }
              ]
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'The Comedy Store',
    venueAddress: '8433 Sunset Blvd',
    venueCity: 'West Hollywood',
    venueState: 'CA',
    venueZipCode: '90069',
    performanceTypes: 'comedy'
  },
  maxItems: 60,
  cleanup: {
    // Card text bleeds promo prefixes into the title on some cards.
    titleStripPatterns: ['^JUST ADDED:\\s*', '^Low Ticket Warning\\s*', '^SOLD OUT\\s*']
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
      console.log('Updated existing Comedy Store DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /^the comedy store$/i } })

    const ds = await DataSourceModel.create({
      name: 'The Comedy Store (thecomedystore.com)',
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
    console.log('Created Comedy Store DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
