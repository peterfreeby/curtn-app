import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// A Noise Within (anoisewithin.org) — Pasadena classical rep. WordPress/Divi,
// two-level scrape. No usable Event JSON-LD (only a WebPage @graph block).
//
// Listing: the season's shows are exposed as the site nav's "play" custom-post
// menu items — <li class="menu-item-object-play"><a href="/play/<slug>/">TITLE</a></li>.
// The menu renders ~4× per page (desktop nav, mobile nav, footer), so each show
// appears 4 times; the detail cache dedups the fetches (keyed on URL+title) and
// the staging helper dedups the rows (keyed on title), collapsing to one
// PendingImport per show. This menu is the cleanest season list — the homepage
// only carries the current production's per-performance "Buy Tickets" instances.
//
// Detail: each /play/<slug>/ page is rich and stable. og:title is the clean show
// name (no venue suffix), og:description the full synopsis, og:image the poster.
// The run-date range lives in `.play-meta-content` ("October 4 – November 1, 2026"),
// and the first AudienceView ticket link (event-details?EventInstanceId=) is the
// "Buy Now" CTA. A show with single tickets not yet on sale simply has no ticket
// link (e.g. the holiday A Christmas Carol before its on-sale date).

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.anoisewithin.org/shows/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'shows',
          label: 'Season',
          selector: 'li.menu-item-object-play',
          children: [
            // Placeholder title (passes the non-empty check) — the detail fetch
            // overrides it with og:title. Also the dedup key.
            { type: 'field', id: 'title', csvField: 'title', selector: 'a', transform: 'trim' },
            {
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
    venueName: 'A Noise Within',
    venueAddress: '3352 E Foothill Blvd',
    venueCity: 'Pasadena',
    venueState: 'CA',
    venueZipCode: '91107',
    performanceTypes: 'theater'
  },
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
            { type: 'field', id: 'title', csvField: 'title', selector: 'meta[property="og:title"]', attribute: 'content', transform: 'trim' },
            { type: 'field', id: 'desc', csvField: 'showDescription', selector: 'meta[property="og:description"]', attribute: 'content', transform: 'trim' },
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: 'meta[property="og:image"]', attribute: 'content', transform: 'trim' },
            // Run-date range: ".play-meta-content" holds e.g. "October 4 – November 1, 2026".
            { type: 'field', id: 'date', csvField: 'date', selector: '.play-meta-content', transform: 'date-range-start' },
            { type: 'field', id: 'runStart', csvField: 'runStartDate', selector: '.play-meta-content', transform: 'date-range-start' },
            { type: 'field', id: 'runEnd', csvField: 'runEndDate', selector: '.play-meta-content', transform: 'date-range-end' },
            // First "Buy Now" ticket link (AudienceView EventInstanceId). Absent
            // until a show's single tickets go on sale.
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="EventInstanceId"]',
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
      console.log('Updated existing A Noise Within DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /a noise within/i } })
    const ds = await DataSourceModel.create({
      name: 'A Noise Within (anoisewithin.org)',
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
    console.log('Created A Noise Within DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing A Noise Within venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
