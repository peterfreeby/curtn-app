import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Theatre Row (theatrerow.org) — programming runs on the BFANY platform at
// bfany.org/theatre-row/. WordPress, two-level scrape.
//
// Listing: bfany.org/theatre-row/ renders one `.cell.medium-4` card per show with
// an `a[title]` (clean title), `img` (poster), and a `<p>` mashing title/company/
// dates: "... Cause Celebre Productions 5/7/2026-5/30/2026". Dates are M/D/YYYY
// ranges — regex the first (start) and the post-hyphen (end) date out of the <p>.
// The `a` href → /theatre-row/shows/<slug>/.
//
// Detail: the show page's og:description carries the synopsis but is TRUNCATED
// with a "… Read more »" tail. The full untruncated synopsis lives in the
// Cornerstone content block `.cs-content`, so we pull that instead (festival
// umbrella pages carry neither — they have no synopsis on the source).
// og:image == the listing poster.
//
// Notes:
//  - Theatre Row is a 5-stage rental house (Acorn/Beckett/Kirk/Lion/Clurman); venue-
//    level row defaults. Tickets are handled by a per-show widget with no stable
//    on-page URL, so ticketUrl is left empty (admin adds at review).
//  - "5/7/2026-5/30/2026" uses a space-less hyphen that parseDateRange won't split,
//    so each end is regexed separately and run through the plain `date` transform.

const TR_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://bfany.org/theatre-row/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.cell.medium-4',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'a[title]',
              attribute: 'title',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'img',
              attribute: 'src',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: 'p',
              regex: '(\\d{1,2}/\\d{1,2}/\\d{4})',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'runStart',
              csvField: 'runStartDate',
              selector: 'p',
              regex: '(\\d{1,2}/\\d{1,2}/\\d{4})',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'runEnd',
              csvField: 'runEndDate',
              selector: 'p',
              regex: '\\d{1,2}/\\d{1,2}/\\d{4}\\s*[-–]\\s*(\\d{1,2}/\\d{1,2}/\\d{4})',
              transform: 'date'
            },
            {
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
    venueName: 'Theatre Row',
    venueAddress: '410 West 42nd Street',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10036',
    performanceTypes: 'theater'
  },
  maxItems: 30,
  // Strip stray <br> markers that leak into .cs-content text. Cosmetic on real
  // shows; on festival umbrella pages the content block is just "<br />", so
  // stripping it empties the field → undefined (no bogus one-tag description).
  cleanup: {
    descriptionStripPatterns: ['<br\\s*/?>']
  },
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'field',
          id: 'description',
          csvField: 'showDescription',
          // Full untruncated synopsis (og:description ends with "… Read more »").
          selector: '.cs-content',
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
      url: TR_CONFIG.startUrl
    })
    if (existing) {
      existing.config = TR_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Theatre Row DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /^theatre\s*row/i } })

    const ds = await DataSourceModel.create({
      name: 'Theatre Row (bfany.org/theatre-row)',
      type: 'scraper',
      url: TR_CONFIG.startUrl,
      config: TR_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Theatre Row DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Theatre Row venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
