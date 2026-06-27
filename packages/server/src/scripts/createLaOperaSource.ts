import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// LA Opera (laopera.org) — performs at the Dorothy Chandler Pavilion. The
// /whats-on grid links each production to /performances/<year>/<slug>, and those
// detail pages carry rich schema.org Event JSON-LD (name, startDate, a full
// description, image, and the venue address) — one Event per performance. So the
// listing just harvests the detail links; detail-fetch with jsonLd:true pulls the
// structured fields, and a template layer overrides the protocol-relative JSON-LD
// image with the absolute og:image. (extractDetail merges ld[0] + the template
// row, so each production yields one row dated to its opening performance.)

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.laopera.org/whats-on',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: 'a[href*="/performances/"]',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: ':self', transform: 'trim' },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: ':self', attribute: 'href', transform: 'trim' },
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: ':self', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Dorothy Chandler Pavilion',
    venueAddress: '135 N Grand Ave',
    venueCity: 'Los Angeles',
    venueState: 'CA',
    venueZipCode: '90012',
    performanceTypes: 'opera'
  },
  maxItems: 60,
  // Two current listings (Renée Fleming recital, Carmen) have no schema.org Event
  // markup yet → no date, so they'd stage title+poster only (below bar). Drop them
  // by year-scoped slug (a future Carmen lives under a different /performances/<yr>/
  // path, so this won't suppress it). ticketUrl carries the detail URL, which the
  // filter matches; this also collapses the duplicate "More Info"/"Info and Tickets"
  // button links that point at the same two pages.
  excludeUrlPatterns: ['/2026/renee-fleming-in-recital', '/2026-27/carmen'],
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
          label: 'Detail image',
          selector: 'html',
          children: [
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'meta[property="og:image"], meta[name="og:image"]',
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
      console.log('Updated existing LA Opera DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /(los angeles opera|^la opera|dorothy chandler)/i } })

    const ds = await DataSourceModel.create({
      name: 'LA Opera (laopera.org)',
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
    console.log('Created LA Opera DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
