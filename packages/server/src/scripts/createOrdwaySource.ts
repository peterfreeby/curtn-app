import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Ordway Center for the Performing Arts (ordway.org) — St. Paul presenting house
// (touring Broadway, concerts, SPCO co-presentations). Nuxt SSR site, no JSON-LD.
//
// The /events listing renders clean, stable `.item` cards carrying everything
// except the poster and blurb: `.title`, a `.sub-title` date range
// ("June 5 - 6, 2026"), a `.genre` performance type, the external ticket link
// (`.link`), and the on-site detail link (`.aside-left`, /events/<slug>).
//
// Detail pages expose a real Contentful poster and the venue's own editorial
// blurb via OG meta (Ordway writes `name="og:image"` / `name="og:description"`,
// not the standard `property=`, so we match both). Co-presented SPCO concerts
// proxy their content off-site and carry a generic house tagline as
// og:description — acceptable minority; most rows are Ordway's own shows.
//
// So: listing harvests title/dates/type/ticket. Each card's relative
// /events/<slug> info-page anchor is the detail URL — that page reliably exposes
// an og:image poster (protocol-relative //images.ctfassets.net, absolutized by
// the URL_FIELDS resolver) and a short editorial og:description. (We deliberately
// do NOT route detail through `.link`: for on-sale shows it's a boxoffice seatmap
// and for SPCO co-pros it's content.thespco.org — neither yields a usable poster
// for every row. The info page does.) A few presented concerts fall back to the
// house tagline as og:description; most carry a real per-show blurb.
//
// runEndDate is intentionally omitted: the .sub-title end part frequently drops
// the month ("June 5 - 6, 2026") which the range parser can't resolve, and some
// carry a "• <hall>" suffix. We keep the reliably-parsed start date instead.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://ordway.org/events/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.item',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.title', transform: 'trim' },
            { type: 'field', id: 'genre', csvField: 'performanceTypes', selector: '.genre', transform: 'trim' },
            // .sub-title is a date range ("June 5 - 6, 2026") or single date,
            // sometimes with a " • <hall>" suffix. The regex strips the suffix
            // first (a bare single date with the suffix won't parse otherwise),
            // then date-range-start yields the (start) date.
            { type: 'field', id: 'date', csvField: 'date', selector: '.sub-title', regex: '^([^•]+)', transform: 'date-range-start' },
            { type: 'field', id: 'runStart', csvField: 'runStartDate', selector: '.sub-title', regex: '^([^•]+)', transform: 'date-range-start' },
            // .link is the best buy/info destination (seatmap when on-sale, the
            // co-presenter's site for SPCO, the info page otherwise).
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: '.link', attribute: 'href', transform: 'trim' },
            // Every card also carries a relative /events/<slug> info-page anchor
            // (class-less, so target by href prefix). That page reliably exposes
            // an og:image poster + an og:description blurb, so use it for detail.
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: 'a[href^="/events/"]', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Ordway Center for the Performing Arts',
    venueAddress: '345 Washington St',
    venueCity: 'Saint Paul',
    venueState: 'MN',
    venueZipCode: '55102'
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
          label: 'Detail OG fields',
          selector: 'html',
          children: [
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'meta[property="og:image"], meta[name="og:image"]',
              attribute: 'content',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'description',
              csvField: 'showDescription',
              selector: 'meta[property="og:description"], meta[name="og:description"]',
              attribute: 'content',
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
      console.log('Updated existing Ordway DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /^ordway/i } })

    const ds = await DataSourceModel.create({
      name: 'Ordway Center (ordway.org)',
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
    console.log('Created Ordway DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
