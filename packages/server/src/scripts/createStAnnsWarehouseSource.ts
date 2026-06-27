import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// St. Ann's Warehouse (stannswarehouse.org) — WordPress, two-level scrape.
//
// Listing: the homepage "Current Season" list is <li class="show_item"><a href="/show/<slug>/">TITLE</a></li>.
// We capture title + the detail URL, then crawl each /show/<slug>/ page.
//
// Detail: each show page has a stable `div.content` header (h1 title, byline h5,
// run-date range in the first h3 — e.g. "MAY 17–JUNE 14, 2026" — and a BUY TICKETS
// link in the second h3 pointing at the Tribe calendar). The full synopsis is the
// first `section.layout-section.full_width`. We deliberately avoid the /calendar
// path (Cloudflare-gated, 403) and JSON-LD (TheaterEvent block exists but carries
// no startDate/endDate and an empty description on most shows).
//
// Notes / known limitations:
//  - Per-performance clock times are only on the Cloudflare-blocked calendar, so
//    `time` is left empty; the run-date range (runStartDate/runEndDate) captures
//    the span and `date` anchors a performance on opening day for the ticket link.
//  - The synopsis section text carries a leading TinyMCE bookmark-span artifact on
//    some shows; the regex strips it (falls through to raw text when absent).

const ST_ANNS_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://stannswarehouse.org/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.show_item',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'a',
              transform: 'trim'
            },
            {
              // Detail-page URL → magic field the orchestrator crawls.
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: "St. Ann's Warehouse",
    venueAddress: '45 Water Street',
    venueCity: 'Brooklyn',
    venueState: 'NY',
    venueZipCode: '11201',
    performanceTypes: 'theater'
  },
  maxItems: 40,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    // The /show/ pages 403 ('Just a moment' Cloudflare challenge) on the 2nd+
    // sequential request when one page/context is reused. A fresh context per
    // fetch resets the per-session anti-bot state (legit CurtnBot UA throughout).
    freshContextPerFetch: true,
    template: {
      version: 2,
      nodes: [
        {
          // Primary date = run start (anchors a performance carrying the ticket link).
          type: 'field',
          id: 'date',
          csvField: 'date',
          selector: '.content h3',
          transform: 'date-range-start'
        },
        {
          type: 'field',
          id: 'runStart',
          csvField: 'runStartDate',
          selector: '.content h3',
          transform: 'date-range-start'
        },
        {
          type: 'field',
          id: 'runEnd',
          csvField: 'runEndDate',
          selector: '.content h3',
          transform: 'date-range-end'
        },
        {
          // BUY TICKETS link lives in the second h3 inside .content (the only <a> there).
          type: 'field',
          id: 'ticketUrl',
          csvField: 'ticketUrl',
          selector: '.content h3 a',
          attribute: 'href',
          transform: 'trim'
        },
        {
          type: 'field',
          id: 'poster',
          csvField: 'showImageUrl',
          selector: 'img.featured-image',
          attribute: 'src',
          transform: 'trim'
        },
        {
          // Full synopsis = first full-width layout section. Strip the leading
          // TinyMCE bookmark-span artifact; fall through to raw text when absent.
          type: 'field',
          id: 'description',
          csvField: 'showDescription',
          selector: 'section.layout-section.full_width',
          regex: '(?:<span[^>]*mce[^>]*>[\\s\\S]*?</span>\\s*)?([\\s\\S]+)',
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
      url: ST_ANNS_CONFIG.startUrl
    })
    if (existing) {
      existing.config = ST_ANNS_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log("Updated existing St. Ann's Warehouse DataSource:", existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({
      name: { $regex: /st\.?\s*ann'?s\s*warehouse/i }
    })

    const ds = await DataSourceModel.create({
      name: "St. Ann's Warehouse (stannswarehouse.org)",
      type: 'scraper',
      url: ST_ANNS_CONFIG.startUrl,
      config: ST_ANNS_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log("Created St. Ann's Warehouse DataSource:", ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log("  no existing St. Ann's venue found — scraper will create one on first run")
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
