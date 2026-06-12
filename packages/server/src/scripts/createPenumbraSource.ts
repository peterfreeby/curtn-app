import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Penumbra Theatre (penumbratheatre.org) — St. Paul; the nation's flagship Black
// theater. WordPress site, no JSON-LD. The /events page renders an upcoming-events
// list as `<section class="events"> <article>…`, one article PER PERFORMANCE
// (a multi-week run like "Joe Turner's Come and Gone" shows ~16 dated articles).
//
// Each article carries: `.day` (weekday/number/"Mon<br>YYYY" — cheerio's text()
// joins to a parseable "Sat 6 Jun 2026"), `.time` ("2:00PM"), a `.image` div with
// a background-image poster, a `.category`, and the title + detail link in
// `.details h3 a` (→ /event/<slug>/#NN). The pipeline groups same-title rows into
// one show with many performances.
//
// Detail pages expose a rich og:description (credits + run dates + synopsis) and a
// large og:image, so detail-fetch overrides the listing's thumbnail and adds the
// blurb. Fingerprint is [title] so all performances of a run share one detail
// fetch.
//
// NOTE: /events also lists a few non-performance items (book clubs, equity panels);
// they stage with performanceTypes=theater and are dropped at admin review. No
// per-row field cleanly distinguishes them, and the mainstage run dominates.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://penumbratheatre.org/events',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.events article',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.details h3 a', transform: 'trim' },
            { type: 'field', id: 'date', csvField: 'date', selector: '.day', transform: 'date' },
            { type: 'field', id: 'time', csvField: 'time', selector: '.time', transform: 'time' },
            {
              // Background-image thumbnail; detail og:image overrides with the
              // full-size poster.
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: '.image',
              attribute: 'style',
              regex: 'url\\(["\']?([^"\')]+)["\']?\\)',
              transform: 'trim'
            },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: '.mainButtons a', attribute: 'href', transform: 'trim' },
            // Strip the per-performance #NN anchor so every performance of a run
            // shares one detail URL → one fetch + cache hits (vs one per date).
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: '.details h3 a', attribute: 'href', regex: '^([^#]+)', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Penumbra Theatre',
    venueAddress: '270 N Kent St',
    venueCity: 'Saint Paul',
    venueState: 'MN',
    venueZipCode: '55102',
    performanceTypes: 'theater'
  },
  maxItems: 60,
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
      console.log('Updated existing Penumbra DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /penumbra/i } })

    const ds = await DataSourceModel.create({
      name: 'Penumbra Theatre (penumbratheatre.org)',
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
    console.log('Created Penumbra DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
