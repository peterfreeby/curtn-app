import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// One-shot script: create a DataSource for the Walker Art Center.
//
// Walker is a contemporary-art museum; its general calendar is dominated by
// exhibitions and films, but it maintains a dedicated PERFORMING-ARTS listing
// at /performances/ — the in-scope subset for a live-performance archive.
// That page renders a clean grid of `.c-event-card`s (title, date+category in
// `.c-event-card__meta`, image, and a `/whats-on/<slug>/` permalink). Cards
// are duplicated across responsive breakpoints; the (title,date) staging
// dedup collapses them.
//
// Detail pages (/whats-on/<slug>/) expose h1, an info panel
// (`.c-event-details__info-panel` → "When … Where … Time 7 pm"), the full
// prose description (`.c-event-details`), and a Walker ticketing link
// (secure.walkerart.org). og:image is absent on detail pages, so the poster
// comes from the listing card image (and is not overwritten by detail).
//
// Dates carry a year in the listing meta but also appear as ranges
// ("Apr 16–17, 2027") that break single-date parsing, so we capture only
// month+day and let the `datetime` transform infer the year (rolling forward
// when the inferred date is >30d in the past — correct for all upcoming rows).

const WALKER_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.walkerart.org/performances/',
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
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.c-event-card__permalink',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a[href*="/whats-on/"]',
              attribute: 'href',
              transform: 'trim'
            },
            {
              // Meta reads e.g. "Thu, Aug 20, 2026 Free Events" or
              // "Apr 16–17, 2027 Performances". Capture month+day; the year is
              // inferred (range hyphens otherwise break Date parsing).
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '.c-event-card__meta',
              regex:
                '\\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{1,2}',
              transform: 'datetime'
            },
            {
              // Card <img> src carries a "?resize=16,10" LQIP-thumbnail query;
              // strip everything from the "?" to recover the full-res asset.
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'img',
              attribute: 'src',
              regex: '^([^?]+)',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Walker Art Center',
    venueAddress: '725 Vineland Pl',
    venueCity: 'Minneapolis',
    venueState: 'MN',
    venueZipCode: '55403'
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
          // The synopsis is the wysiwyg text-column: `.c-wysiwyg.c-col-text-area`
          // uniquely tags it on both "Performances" and "Free Events" layouts.
          // Avoid `.c-event-details__info` (a competing element wraps the
          // tickets/When-Where-Time widget boilerplate) and `.c-col-textarea`
          // (no hyphen — that's the artist-bio/accessibility blocks).
          type: 'field',
          id: 'desc',
          csvField: 'showDescription',
          selector: '.c-wysiwyg.c-col-text-area',
          transform: 'trim'
        },
        {
          // Start time from the info panel ("When … Where … Time 7 pm").
          type: 'field',
          id: 'time',
          csvField: 'time',
          selector: '.c-event-details__info-panel',
          regex: '\\d{1,2}(?::\\d{2})?\\s*[apAP][mM]',
          transform: 'time'
        },
        {
          // Walker's ticketing portal link.
          type: 'field',
          id: 'ticket',
          csvField: 'ticketUrl',
          selector: 'a[href*="secure.walkerart.org"]',
          attribute: 'href',
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
      url: WALKER_CONFIG.startUrl
    })
    if (existing) {
      existing.config = WALKER_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Walker Art Center DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({
      name: { $regex: /^walker art center$/i }
    })

    const ds = await DataSourceModel.create({
      name: 'Walker Art Center (walkerart.org/performances)',
      type: 'scraper',
      url: WALKER_CONFIG.startUrl,
      config: WALKER_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Walker Art Center DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Walker Art Center venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
