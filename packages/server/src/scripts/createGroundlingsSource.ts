import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — The Groundlings Theatre, Los Angeles.
// Container: .show ×29 on /shows (includes "now playing" and "also coming up").
// Date in p.date is schedule text ("Friday and Saturday @ 7:30pm"), not a
// specific calendar date — stored raw. Ticket URL links to purchase.groundlings.com.
// Images are relative paths — engine resolves against startUrl.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.groundlings.com/shows',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.show',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h2.show-title',
              transform: 'trim'
            },
            {
              // Schedule text e.g. "Friday and Saturday @ 7:30pm" — stored raw.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: 'p.date',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showDescription',
              csvField: 'showDescription',
              selector: '.show-info p:not(.date)',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a.button',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showImageUrl',
              csvField: 'showImageUrl',
              selector: 'img',
              attribute: 'src',
              transform: 'trim'
            },
            {
              // Detail-page link ("/shows/<slug>") off the title. Consumed by the
              // detail fetch below (also the ticketUrl fallback). Scoped to the
              // title anchor so the poster-only nested .show (no h2) yields no row.
              type: 'field',
              id: '_detailUrl',
              csvField: '_detailUrl',
              selector: 'h2.show-title a',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  // The listing blurb is unreliable: the CMS often renders an EMPTY
  // <p class="description"> and puts the real copy in a bare sibling <p>, so
  // ".show-info p:not(.date)" grabbed the empty node. Follow each show's detail
  // page and read section.body instead — the full, consistent synopsis. The
  // body is JS-hydrated (empty on first paint), so waitForSelector holds until
  // it populates; freshContextPerFetch avoids stale hydration on later fetches.
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    // Wait on the synopsis paragraph itself (not the section wrapper): the body
    // is JS-hydrated and the wrapper briefly holds whitespace, so waiting on the
    // <p> guarantees real copy before capture. freshContextPerFetch avoids stale
    // hydration on later fetches in the batch.
    waitForSelector: 'section.body .content p',
    freshContextPerFetch: true,
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Show body',
          selector: 'html',
          children: [
            // The first paragraph of the body = the clean synopsis. Reading the
            // whole section.body dragged in the showtime/cast tables as whitespace.
            { type: 'field', id: 'showDescription', csvField: 'showDescription', selector: 'section.body .content p', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'The Groundlings Theatre',
    venueAddress: '7307 Melrose Ave',
    venueCity: 'Los Angeles',
    venueState: 'CA',
    venueZipCode: '90046',
    performanceTypes: 'comedy'
  },
  maxItems: 30
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found')

    const existing = await DataSourceModel.findOne({ type: 'scraper', url: CONFIG.startUrl })
    if (existing) {
      existing.name = 'The Groundlings Theatre (groundlings.com)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Groundlings DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /groundlings/i } })

    const ds = await DataSourceModel.create({
      name: 'The Groundlings Theatre (groundlings.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Groundlings DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Groundlings venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
