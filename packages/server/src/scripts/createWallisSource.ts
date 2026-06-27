import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Wallis Annenberg Center for the Performing Arts (thewallis.org) — Tier 2
// template off the /shows season listing. Custom CMS (presenter house): the
// homepage and /calendar render JS show-card facades and per-showtime FullCalendar
// noise, but /shows is a clean server-rendered listing where each production is a
// .show-item carrying every field we need:
//
//   .show-title a       → title + detail-page URL (/show-details/<slug>)
//   .show-time          → run range "Jun 4, 2026 - Jun 6, 2026" (date-range transforms)
//   .show-description    → full marketing blurb (not truncated)
//   .show-cat span      → performance type ("DANCE" / "COMEDY" / "THEATER" / "MUSIC")
//   .show-buttons a[tickets.thewallis.org] → real Buy Tickets link
//   .gallery__card-image → poster (data-src === src, a webp)
//
// Detail /show-details pages DO carry a TheaterEvent JSON-LD node, but its
// `description` is templated wrong on their side (shows another show's blurb),
// so we deliberately stay on the listing — it's complete and correct. Cast/credits
// are not structurally exposed (touring dance/music/comedy presenter), so omitted
// per the "where the site exposes them" rule.
//
// Not-yet-on-sale shows render only a "More Info" button (no tickets.thewallis.org
// link) and so stage without a ticketUrl — left for admin review rather than
// shipping a ticketless row.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://thewallis.org/shows',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'shows',
          label: 'Productions',
          selector: '.show-item',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.show-title', transform: 'trim' },
            {
              // ".show-time" → "Jun 4, 2026 - Jun 6, 2026" (year on both ends).
              // Single-night events render just "Jun 6, 2026" → start === end.
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: '.show-time',
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runEndDate',
              csvField: 'runEndDate',
              selector: '.show-time',
              transform: 'date-range-end'
            },
            { type: 'field', id: 'description', csvField: 'showDescription', selector: '.show-description', transform: 'trim' },
            {
              // Category badge → performanceTypes; importer lowercases + filters
              // against the canonical enum (DANCE→dance, COMEDY→comedy, etc.).
              type: 'field',
              id: 'performanceTypes',
              csvField: 'performanceTypes',
              selector: '.show-cat',
              transform: 'trim'
            },
            {
              // Real Buy Tickets link only — excludes "More Info" (detail page)
              // buttons so not-yet-on-sale shows stage without a bogus ticketUrl.
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: '.show-buttons a[href*="tickets.thewallis.org"]',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: '.gallery__card-image',
              attribute: 'src',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: '.show-title a',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Wallis Annenberg Center for the Performing Arts',
    venueAddress: '9390 N Santa Monica Blvd',
    venueCity: 'Beverly Hills',
    venueState: 'CA',
    venueZipCode: '90210'
  },
  // /shows lists the full announced 2026/27 season; most are not yet on sale and
  // render only a "More Info" button (their detail JSON-LD offers carry no url —
  // just a generic empty-cart link). Keep only rows with a real Buy Tickets link
  // so every staged row clears the quality bar (title + run dates + ticketUrl +
  // poster + full description + type). Future runs auto-pick-up each show as it
  // goes on sale and gains a tickets.thewallis.org link.
  includeUrlPatterns: ['tickets.thewallis.org'],
  maxItems: 50
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
      console.log('Updated existing Wallis DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /wallis/i } })
    const ds = await DataSourceModel.create({
      name: 'Wallis Annenberg Center (thewallis.org)',
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
    console.log('Created Wallis DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Wallis venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
