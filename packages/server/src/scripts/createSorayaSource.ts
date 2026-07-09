import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// The Soraya (thesoraya.org) — Younes & Soraya Nazarian Center, CSUN; presents
// dance, music, and global performance. The /whats-on page (Playwright-rendered)
// lists `.c-event-card`s with `.c-event-card__permalink` (title + link to
// /whats-on/en/<slug>), a `.c-event-card__daterange` ("Sat Sep 19 | 8PM" → regex
// the date and the time), and a `.lazyautosizes` poster. Detail pages carry a
// clean og:title and a full og:description.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.thesoraya.org/whats-on',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.c-event-card',
          children: [
            // Placeholder title (card label) — detail og:title overrides it.
            { type: 'field', id: 'title', csvField: 'title', selector: '.c-event-card__permalink', transform: 'trim' },
            { type: 'field', id: 'date', csvField: 'date', selector: '.c-event-card__daterange', regex: '([A-Z][a-z]{2}\\s+\\d{1,2})', transform: 'date' },
            { type: 'field', id: 'time', csvField: 'time', selector: '.c-event-card__daterange', regex: '(\\d{1,2}(?::\\d{2})?\\s*[AP]M)', transform: 'time' },
            // images.thesoraya.org serves a downscaled crop via a ?resize=/?fit=
            // query (the card src is a 16px lazyload placeholder). Strip the query
            // to request the original full-res upload. Detail og:image overrides
            // this, but a strong fallback keeps posters sharp if detail fails.
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: 'img', attribute: 'src', regex: '^([^?]+)', transform: 'trim' },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: '.c-event-card__permalink', attribute: 'href', transform: 'trim' },
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: '.c-event-card__permalink', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'The Soraya',
    venueAddress: '18111 Nordhoff St',
    venueCity: 'Northridge',
    venueState: 'CA',
    venueZipCode: '91330'
    // performanceTypes unset — Soraya mixes dance / music / global performance.
  },
  maxItems: 50,
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
            // og:title is "<title> | <Month Day>"; keep the part before the pipe.
            { type: 'field', id: 'title', csvField: 'title', selector: 'meta[property="og:title"]', attribute: 'content', regex: '^(.+?)\\s*\\|', transform: 'trim' },
            // og:image is a ?fit=1024,1024 downscale (e.g. 1024x657). Strip the
            // query to get the native upload (e.g. 1324x850) — sharper poster.
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: 'meta[property="og:image"], meta[name="og:image"]', attribute: 'content', regex: '^([^?]+)', transform: 'trim' },
            { type: 'field', id: 'description', csvField: 'showDescription', selector: 'meta[property="og:description"], meta[name="og:description"]', attribute: 'content', transform: 'trim' }
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
      console.log('Updated existing Soraya DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /soraya/i } })

    const ds = await DataSourceModel.create({
      name: 'The Soraya (thesoraya.org)',
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
    console.log('Created Soraya DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
