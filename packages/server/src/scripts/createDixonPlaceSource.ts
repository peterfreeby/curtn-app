import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Dixon Place (dixonplace.org) — WordPress / YOOtheme (UIKit), two-level scrape.
//
// Listing: /category/all-events/ renders one `.el-item.uk-card` per show, each with
// `.el-title` (title), `img.el-image` (poster thumbnail, relative URL), and an
// `a.el-link` "More info…" → /performances/<slug>/. (Plain `.el-item` without
// uk-card are header buttons — excluded by the uk-card qualifier.)
//
// Detail: /performances/<slug>/ has the title (h1), a single `.uk-h4` date/time
// line (e.g. "June 6th 2026 at 7 PM"), and the synopsis as the first <p> inside
// `.uk-panel.uk-margin`. No JSON-LD / og tags (YOOtheme emits neither).
//
// Notes:
//  - Date/time are human-formatted with an ordinal ("6th") that breaks Date.parse,
//    so regex pulls "Month Day" for the date (year inferred — all current shows are
//    2026) and the clock time separately. Multi-date runs (e.g. "June 3, 4, 5 & 9")
//    capture the first date; admin review can expand.
//  - Tickets route through a single OvationTix client portal (ci.ovationtix.com/35526)
//    for every show, set as a row default.

const DIXON_PLACE_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://dixonplace.org/category/all-events/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.el-item.uk-card',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.el-title',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'img.el-image',
              attribute: 'src',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a.el-link',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Dixon Place',
    venueAddress: '161A Chrystie Street',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10002',
    performanceTypes: 'theater',
    ticketUrl: 'https://ci.ovationtix.com/35526'
  },
  maxItems: 30,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    // A clean context per page: a couple of detail pages (an emoji-in-slug URL,
    // and one card that links to an already-fetched slug) came back empty when
    // the batch reused a single page. A fresh context per fetch clears that.
    freshContextPerFetch: true,
    template: {
      version: 2,
      nodes: [
        {
          type: 'field',
          id: 'titleDetail',
          csvField: 'title',
          selector: 'h1',
          transform: 'trim'
        },
        {
          // ".uk-h4" e.g. "June 6th 2026 at 7 PM" — pull "Month Day" (ordinal/year
          // dropped; current year inferred by the date transform).
          type: 'field',
          id: 'date',
          csvField: 'date',
          selector: '.uk-h4',
          regex: '([A-Za-z]+\\s+\\d{1,2})',
          transform: 'date'
        },
        {
          type: 'field',
          id: 'time',
          csvField: 'time',
          selector: '.uk-h4',
          regex: '(\\d{1,2}(?::\\d{2})?\\s*[APap]\\.?[Mm])',
          transform: 'time'
        },
        {
          // Synopsis = the first .uk-panel.uk-margin block's text. Targeting a
          // `p` inside it broke two ways: shows whose blurb is pasted from Gmail
          // wrap it in <div class="gmail_default"> (no <p>, so the field went
          // empty), and others have no leading <p> so the first matching <p> fell
          // through to the "Tickets:" panel. Reading the panel itself captures the
          // synopsis (plus any FEATURING lineup) on every layout.
          type: 'field',
          id: 'description',
          csvField: 'showDescription',
          selector: '.uk-panel.uk-margin',
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
      url: DIXON_PLACE_CONFIG.startUrl
    })
    if (existing) {
      existing.config = DIXON_PLACE_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Dixon Place DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /^dixon\s*place/i } })

    const ds = await DataSourceModel.create({
      name: 'Dixon Place (dixonplace.org)',
      type: 'scraper',
      url: DIXON_PLACE_CONFIG.startUrl,
      config: DIXON_PLACE_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Dixon Place DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Dixon Place venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
