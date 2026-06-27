import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// One-shot script: create a DataSource for the Baryshnikov Arts Center (BAC).
//
// WordPress site. The /nyc-shows-events/ page lists current productions as
// `.performance` cards, each linking to a /performance/<slug>/ detail page.
// Detail pages expose:
//   • h1                               → title
//   • .ba-performance-meta             → credits + date ("September 24–26")
//                                        + start time ("7 PM") + prices +
//                                        run length + stage
//   • .entry-content                   → performers/credits + full synopsis
//   • a[href*="ovationtix"]            → OvationTix ticket link
//   • meta[property="og:image"]        → poster
//
// One row per production. Date is captured month+day from the meta (year
// inferred by the datetime transform — all current rows are fall 2026); the
// start time is the first am/pm token in the meta (before the on-sale date).

const BAC_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://baryshnikovarts.org/nyc-shows-events/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.performance',
          children: [
            {
              // Each card carries its own h1 title; needed so the listing row
              // survives title validation before detail enrichment runs.
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h1',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a[href*="/performance/"]',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Baryshnikov Arts Center',
    venueAddress: '450 W 37th St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10018'
  },
  maxItems: 50,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'field',
          id: 'title',
          csvField: 'title',
          selector: 'h1',
          transform: 'trim'
        },
        {
          // Performers/credits + full synopsis prose.
          type: 'field',
          id: 'desc',
          csvField: 'showDescription',
          selector: '.entry-content',
          transform: 'trim'
        },
        {
          // First performance date in the meta block. The on-sale date
          // ("General on-sale begins July 7") appears later, so the first
          // month+day match is the performance date.
          type: 'field',
          id: 'date',
          csvField: 'date',
          selector: '.ba-performance-meta',
          regex:
            '\\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{1,2}',
          transform: 'datetime'
        },
        {
          // Start time ("7 PM"); first am/pm token in the meta.
          type: 'field',
          id: 'time',
          csvField: 'time',
          selector: '.ba-performance-meta',
          regex: '\\d{1,2}(?::\\d{2})?\\s*[apAP][mM]',
          transform: 'time'
        },
        {
          type: 'field',
          id: 'ticket',
          csvField: 'ticketUrl',
          selector: 'a[href*="ovationtix"]',
          attribute: 'href',
          transform: 'trim'
        },
        {
          type: 'field',
          id: 'poster',
          csvField: 'showImageUrl',
          selector: 'meta[property="og:image"]',
          attribute: 'content',
          transform: 'trim'
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

    const existing = await DataSourceModel.findOne({
      type: 'scraper',
      url: BAC_CONFIG.startUrl
    })
    if (existing) {
      existing.config = BAC_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Baryshnikov Arts DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({
      name: { $regex: /baryshnikov/i }
    })

    const ds = await DataSourceModel.create({
      name: 'Baryshnikov Arts Center (baryshnikovarts.org)',
      type: 'scraper',
      url: BAC_CONFIG.startUrl,
      config: BAC_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Baryshnikov Arts DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Baryshnikov venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
