import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// One-shot script: create a DataSource for southerntheater.org.
//
// The Southern is a Cedar-Riverside presenting house (dance, theater, music),
// Bootstrap-rendered. The homepage lists current productions as `.card`s that
// link to /shows/<slug> detail pages. Detail pages come in two layouts:
//   A) a single rich <p> block + a <table.table> of dated performances with
//      internal /purchase links (box office run by the Southern), and
//   B) multiple <p> blocks + a single external ticket link (a.btn-primary)
//      when the resident company runs its own box office.
// Both layouts share a stable spine: `#page-content h1` (title), the first
// `#page-content > div h3` (producing company), `.show-page-image img`
// (poster), and an inner `#page-content > div` whose text carries the full
// description, Performance Dates, length, and Featured Artists/credits.
//
// We extract one row per show. Date/time are pulled from the description
// block by regex ("Month DD" + "H:MM(am|pm)") — both layouts state the first
// performance that way, with the year omitted, which the `datetime`/`time`
// transforms backfill against the current year.

const SOUTHERN_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://southerntheater.org/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.card',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.card-title',
              transform: 'trim'
            },
            {
              // Card wrapper link → detail page. Constrained to /shows/ so any
              // non-show cards (none seen, but defensive) yield no detail URL.
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a[href*="/shows/"]',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Southern Theater',
    venueAddress: '1420 S Washington Ave',
    venueCity: 'Minneapolis',
    venueState: 'MN',
    venueZipCode: '55454'
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
          // Inner content div: holds image, producer h3, title h1, and the
          // full description text (dates, length, story, credits). Unique
          // direct-div child of #page-content in both detail layouts.
          selector: '#page-content > div',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h1',
              transform: 'trim'
            },
            {
              // Producing company / artist ("Uncharted Theatre Company
              // presents", "Dance Projects by ME"). First (only) h3 in block.
              type: 'field',
              id: 'company',
              csvField: 'companyName',
              selector: 'h3',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: '.show-page-image img',
              attribute: 'src',
              transform: 'trim'
            },
            {
              // Whole inner block text: Performance Dates + length + full
              // description + Featured Artists/credits. Rich full description.
              type: 'field',
              id: 'desc',
              csvField: 'showDescription',
              selector: ':scope',
              transform: 'trim'
            },
            {
              // First performance calendar date from the block text. Year is
              // omitted on the page; the datetime transform backfills it.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: ':scope',
              // Matches full or 3-letter-abbreviated month + day ("June 26",
              // "Oct 10"). Both detail layouts use one or the other. The day
              // number after \s+ guards against matching names like "Mayhough".
              regex:
                '\\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{1,2}',
              transform: 'datetime'
            },
            {
              // First performance start time from the block text. The show
              // time is always stated before the doors/house times, so the
              // first match wins. Allows minute-less ("7pm") and either case
              // ("7:30PM") — the field regex runs without an `i` flag.
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: ':scope',
              regex: '\\d{1,2}(?::\\d{2})?\\s*[apAP][mM]',
              transform: 'time'
            }
          ]
        },
        {
          // Ticket link lives OUTSIDE the inner div in both layouts: an
          // internal /purchase link (table, box office run by the Southern)
          // or an external company link (a.btn-primary). Top-level field so
          // it is not scoped to the description container.
          type: 'field',
          id: 'ticket',
          csvField: 'ticketUrl',
          selector:
            '#page-content a[href*="/purchase"], #page-content a.btn-primary[href^="http"]',
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
      url: SOUTHERN_CONFIG.startUrl
    })
    if (existing) {
      existing.config = SOUTHERN_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Southern Theater DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({
      name: { $regex: /^southern theater$/i }
    })

    const ds = await DataSourceModel.create({
      name: 'Southern Theater (southerntheater.org)',
      type: 'scraper',
      url: SOUTHERN_CONFIG.startUrl,
      config: SOUTHERN_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Southern Theater DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Southern Theater venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
