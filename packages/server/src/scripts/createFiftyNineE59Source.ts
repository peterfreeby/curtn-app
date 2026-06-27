import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// 59E59 Theaters (59e59.org) — Tier 2 template, listing-only.
//
// /shows/calendar-listing/ renders .show-list-item cards (django-filer CMS) with
// a clean structure: title (.title a), portrait poster (img.portrait), and a
// .meta block of label/value line-items ("Produced by:", "Dates:", "Season:",
// "Theater:"). Run dates are year-less on the card ("May 13 - June 07") — regex
// them out of .meta and apply the date-range transforms (current-year assumed;
// fine for a current-season listing, admin corrects any cross-year edge case).
//
// No prose synopsis: detail pages (/shows/show-detail/<slug>/) lead with a
// metadata <dl>, credits, company bio, and review quotes — there's no clean
// marketing description to extract, and og:description is empty. So we ship the
// rich card record (title / run dates / poster / company) without a description.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.59e59.org/shows/calendar-listing/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'shows',
          label: 'Shows',
          selector: '.show-list-item',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.title a', transform: 'trim' },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'img.portrait',
              attribute: 'src',
              transform: 'trim'
            },
            {
              // .meta is "Produced by: X Dates: May 13 - June 07 Season: Y …".
              // Pull the Dates value (stop at the next label) for the range
              // transforms. Year-less → current-year assumed.
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: '.meta',
              regex: 'Dates:\\s*([A-Za-z]+\\.?\\s+\\d{1,2}\\s*[-\\u2013]\\s*[A-Za-z]+\\.?\\s+\\d{1,2}(?:,?\\s*\\d{4})?)',
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runEndDate',
              csvField: 'runEndDate',
              selector: '.meta',
              regex: 'Dates:\\s*([A-Za-z]+\\.?\\s+\\d{1,2}\\s*[-\\u2013]\\s*[A-Za-z]+\\.?\\s+\\d{1,2}(?:,?\\s*\\d{4})?)',
              transform: 'date-range-end'
            },
            {
              // "Produced by: X Dates: …" → the producing company name.
              type: 'field',
              id: 'company',
              csvField: 'companyName',
              selector: '.meta',
              regex: 'Produced by:\\s*(.+?)\\s*Dates:',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: '.title a',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: '59E59 Theaters',
    venueAddress: '59 East 59th Street',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10022',
    performanceTypes: 'theater'
  },
  // The calendar-listing repeats each show across many calendar cells (~276
  // items for ~26 shows). Cap high so all unique shows are captured pre-dedup;
  // staging collapses the duplicates by (title, venue).
  maxItems: 300
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
      console.log('Updated 59E59 DataSource:', existing._id.toString())
      return
    }
    const venue = await VenueModel.findOne({ name: { $regex: /^59e59/i } })
    const ds = await DataSourceModel.create({
      name: '59E59 Theaters (59e59.org)',
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
    console.log('Created 59E59 DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
