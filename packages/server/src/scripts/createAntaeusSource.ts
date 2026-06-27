import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Antaeus Theatre Company (antaeus.org), Glendale — Tier 2 template off the
// /plays-events listing. Same "adx" CMS family as Wallis: each event is an
// .event-item-list-adx carrying title (h2 a), a run-date range (<time>,
// "May 10, 2026 - Jun 15, 2026"), a full .show-description, a poster image, and a
// /show-details/<slug> link.
//
// The listing mixes the produced SEASON (Antigone, ClassicsFest, Heartbreak
// House, Miss Julie, Romeo and Juliet) with ACADEMY/MASTERCLASS training classes
// (slugs contain "academy"/"masterclass") — not performances. We stage ticketUrl
// at the listing stage with the /show-details URL purely so excludeUrlPatterns can
// drop the classes before detail-fetch; the detail step then overrides ticketUrl
// with the real OvationTix purchase link (the adx detail pages also carry
// TheaterEvent JSON-LD).

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://antaeus.org/plays-events',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.event-item-list-adx',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: 'h2', transform: 'trim' },
            { type: 'field', id: 'runStartDate', csvField: 'runStartDate', selector: 'time', transform: 'date-range-start' },
            { type: 'field', id: 'runEndDate', csvField: 'runEndDate', selector: 'time', transform: 'date-range-end' },
            { type: 'field', id: 'description', csvField: 'showDescription', selector: '.show-description', transform: 'trim' },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'img',
              attribute: 'src',
              transform: 'trim'
            },
            {
              // Temp ticketUrl = the detail URL, so excludeUrlPatterns can drop
              // academy/masterclass classes pre-detail. Detail-fetch overrides it.
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="/show-details/"]',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a[href*="/show-details/"]',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Antaeus Theatre Company',
    venueAddress: '110 East Broadway',
    venueCity: 'Glendale',
    venueState: 'CA',
    venueZipCode: '91205',
    performanceTypes: 'theater'
  },
  // Drop training classes; keep produced plays + ClassicsFest.
  excludeUrlPatterns: ['academy', 'masterclass'],
  maxItems: 40,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Show detail',
          selector: 'html',
          children: [
            {
              // The show-level OvationTix purchase link (production page).
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="ovationtix"][href*="production"]',
              attribute: 'href',
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
      console.log('Updated existing Antaeus DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /antaeus/i } })
    const ds = await DataSourceModel.create({
      name: 'Antaeus Theatre Company (antaeus.org)',
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
    console.log('Created Antaeus DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Antaeus venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
