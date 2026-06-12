import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// 54 Below (54below.com), Midtown — Tier 2 template off the homepage upcoming-
// events grid. Each .upcoming-events__slide carries title (.feature-event__title
// h3 a → 54below.org/events/<slug>), a poster <img>, a date string
// (.feature-event__date — single "June 9, 2026" or a residency list "Nov 29,
// Dec 1, 2, … 2026"), and a real Salesforce ticket link (a.default-btn "Tickets").
// Detail pages have no JSON-LD; the synopsis comes from the og:description.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://54below.com/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.upcoming-events__slide',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.feature-event__title h3', transform: 'trim' },
            { type: 'field', id: 'date', csvField: 'date', selector: '.feature-event__date', transform: 'date' },
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: 'img', attribute: 'src', transform: 'trim' },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: 'a.default-btn', attribute: 'href', transform: 'trim' },
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: '.feature-event__title h3 a', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: '54 Below',
    venueAddress: '254 W 54th St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10019',
    performanceTypes: 'cabaret'
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
            { type: 'field', id: 'desc', csvField: 'showDescription', selector: 'meta[property="og:description"]', attribute: 'content', transform: 'trim' }
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
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing 54 Below DataSource:', existing._id.toString())
      return
    }
    const venue = await VenueModel.findOne({ name: { $regex: /54 below/i } })
    const ds = await DataSourceModel.create({
      name: '54 Below (54below.com)',
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
    console.log('Created 54 Below DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
