import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Irish Repertory Theatre (irishrep.org) — Tier 2 template + detail-fetch.
//
// /show/ ("What's On") renders .event-card articles with title
// (.event-card__title), a year-bearing run range (.event-card__date, e.g.
// "June 13 — August 2, 2026"), and an S3 poster (.event-card__image img). The
// page mixes in fundraisers (Annual Auction / Gala / Raffle) whose date field
// is a single date or promo blurb — filter those out by their /whats-on/ slugs.
//
// Detail pages (/whats-on/<slug>) carry the show synopsis as a clean
// `og:description` meta tag (real shows only — fundraiser pages have generic
// venue boilerplate there, but those are already filtered out by slug).

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://irishrep.org/show/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'shows',
          label: 'Shows',
          selector: '.event-card',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.event-card__title', transform: 'trim' },
            {
              // "June 13 — August 2, 2026" — year-bearing run range.
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: '.event-card__date',
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runEndDate',
              csvField: 'runEndDate',
              selector: '.event-card__date',
              transform: 'date-range-end'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: '.event-card__image img',
              attribute: 'src',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: '.event-card__title a',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: '.event-card__title a',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  // Drop the recurring fundraisers (not productions).
  excludeUrlPatterns: ['/auction', '/gala', '/raffle'],
  rowDefaults: {
    venueName: 'Irish Repertory Theatre',
    venueAddress: '132 West 22nd Street',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10011',
    performanceTypes: 'theater'
  },
  maxItems: 30,
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
          selector: 'head',
          children: [
            {
              type: 'field',
              id: 'desc',
              csvField: 'showDescription',
              selector: 'meta[property="og:description"]',
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
      console.log('Updated Irish Rep DataSource:', existing._id.toString())
      return
    }
    const venue = await VenueModel.findOne({ name: { $regex: /irish rep/i } })
    const ds = await DataSourceModel.create({
      name: 'Irish Repertory Theatre (irishrep.org)',
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
    console.log('Created Irish Rep DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
