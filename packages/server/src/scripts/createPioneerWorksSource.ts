import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Pioneer Works — Red Hook, mixed-discipline (music, talks, immersive theater,
// salons). Next.js + Sanity SPA. The /programs grid has no per-card JSON-LD, but
// each detail page carries a full schema.org Event (name, startDate/endDate,
// full description, clean Sanity image, location+address) — so we enumerate
// detail URLs from the listing and detail-follow with jsonLd: true.
//
// Two gaps the JSON-LD doesn't cover: (1) time — lives in a DOM ".time" block
// ("Doors: 7pm" / "Start: 8pm"); a template overlay grabs it. (2) ticket URL —
// the "Buy tickets" CTA is a JS modal with no static href, so we fall back to
// the event page URL captured in the listing. Workshops (/classes/) are
// excluded; only programs ship.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://pioneerworks.org/programs',
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
              selector: 'h3',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a.card-thumbnail',
              attribute: 'href',
              transform: 'trim'
            },
            {
              // No static ticket link on the site (Buy Tickets is a JS modal),
              // so the event page is the ticket fallback. Also drives the
              // /classes/ exclusion below (matched against ticketUrl).
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a.card-thumbnail',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  // Drop the 3 workshop cards (/classes/...); keep performance programs.
  excludeUrlPatterns: ['/classes/'],
  rowDefaults: {
    venueName: 'Pioneer Works',
    venueAddress: '159 Pioneer Street',
    venueCity: 'Brooklyn',
    venueState: 'NY',
    venueZipCode: '11231'
  },
  maxItems: 50,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    jsonLd: true,
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Detail overlay',
          selector: 'body',
          children: [
            {
              // First .time block (e.g. "Doors:  7pm"); capture the time token.
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: '.time',
              regex: '(\\d{1,2}(?::\\d{2})?\\s*[apAP][mM])',
              transform: 'time'
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

    const existing = await DataSourceModel.findOne({
      type: 'scraper',
      url: CONFIG.startUrl
    })
    if (existing) {
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Pioneer Works DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({
      name: { $regex: /pioneer works/i }
    })

    const ds = await DataSourceModel.create({
      name: 'Pioneer Works (pioneerworks.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Pioneer Works DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
