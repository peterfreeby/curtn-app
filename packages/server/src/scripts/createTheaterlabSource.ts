import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Theaterlab (theaterlabnyc.com) — WordPress, two-level scrape.
//
// Listing: /news/ ("NOW AND NEXT") renders one `article.post` per upcoming
// showing, each with a per-item poster `img`, and a `.post-title` whose text mashes
// program, title, and date: "Atelier @ Theaterlab | Third Spaces by Dylan Sherman
// | June 10-14, '26". The date is pulled by regex ("Month Day" → year inferred;
// range tails like "-14" dropped). The link → /<slug>/.
//
// Detail: the show page's first `h2` is the clean title ("THIRD SPACES"), with a
// show-specific OvationTix link and the synopsis in the content. No og tags.
//
// Notes:
//  - Small lab/residency venue (2 work-in-progress showings at a time).
//  - `time` left empty (per-performance times are in a prose schedule); range end
//    dropped (single anchor date), so multi-day showings stage one date — admin extends.

const TLAB_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://theaterlabnyc.com/news/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: 'article.post',
          children: [
            {
              // The title-required filter runs on LISTING rows BEFORE detail
              // enrichment, so the listing must supply a non-empty title or the
              // row is dropped before the detail h2 can set the clean title. This
              // mashed value ("Program | Title by Artist | Date") is overwritten
              // by the detail page's h2.
              type: 'field',
              id: 'listTitle',
              csvField: 'title',
              selector: '.post-title',
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
              // Date = first "Month Day" in the mashed title; year inferred.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '.post-title',
              regex: '([A-Z][a-z]+\\s+\\d{1,2})',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: '.post-title a',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Theaterlab',
    venueAddress: '357 West 36th Street',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10018',
    performanceTypes: 'theater'
  },
  maxItems: 15,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['date'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'field',
          id: 'title',
          csvField: 'title',
          selector: 'h2',
          transform: 'trim'
        },
        {
          type: 'field',
          id: 'ticketUrl',
          csvField: 'ticketUrl',
          selector: 'a[href*="ovationtix"]',
          attribute: 'href',
          transform: 'trim'
        }
        // No showDescription: the synopsis lives in an undifferentiated
        // `.tb_text_wrap p` block at an inconsistent index (4 on one show, 3 on
        // another; indices 1-3 are credits), so first-match grabs a header/credit
        // line. Omitted rather than stage a misleading description — admin adds it.
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
      url: TLAB_CONFIG.startUrl
    })
    if (existing) {
      existing.config = TLAB_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Theaterlab DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /theater\s*lab/i } })

    const ds = await DataSourceModel.create({
      name: 'Theaterlab (theaterlabnyc.com)',
      type: 'scraper',
      url: TLAB_CONFIG.startUrl,
      config: TLAB_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Theaterlab DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Theaterlab venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
