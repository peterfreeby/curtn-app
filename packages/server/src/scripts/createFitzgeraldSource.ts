import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Fitzgerald Theater (Saint Paul) — operated by First Avenue; the standalone
// fitzgeraldtheater.com domain is dead (301 to nothing), so the live listing is
// First Avenue's per-venue page. WordPress site, no JSON-LD.
//
// The venue page renders `.show_list_item` cards. Title sizing flips between
// `.lg`/`.xl` by length, so we target the title by its anchor instead: the card
// holds two /event/ links — the poster (`a.gig_poster_container`) and the title
// link — so `a[href*="/event/"]:not(.gig_poster_container)` is the stable title,
// and the poster anchor's href is the detail URL.
//
// Each /event/ detail page carries the rich fields: og:image poster, a headliner
// bio paragraph (`.performer_content_col .content p.mb-2`), Doors/Show times in
// a `<h6>label</h6><h2>value</h2>` grid (the 2nd h2.mt-1 is "Show Starts"), and a
// templated og:description that always opens "On <Month D, YYYY> at ..." — we
// regex the date out of it (the listing date is split across month/day/ordinal
// with no year, so the og line is cleaner).
//
// NOTE: cancelled shows still list here (a `.status` of "Cancelled"); First Ave
// exposes no field we can cleanly filter on, so the rare cancelled row stages and
// is dropped at admin review.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://first-avenue.com/venue/the-fitzgerald-theater/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.show_list_item',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: 'a[href*="/event/"]:not(.gig_poster_container)', transform: 'trim' },
            // The event page is the buy/info destination; use it for both the
            // ticket link and the detail-fetch URL.
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: '.gig_poster_container', attribute: 'href', transform: 'trim' },
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: '.gig_poster_container', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Fitzgerald Theater',
    venueAddress: '10 E Exchange St',
    venueCity: 'Saint Paul',
    venueState: 'MN',
    venueZipCode: '55101'
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
          selector: 'html',
          children: [
            {
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: 'meta[property="og:description"], meta[name="og:description"]',
              attribute: 'content',
              regex: 'On ([A-Za-z]+ \\d{1,2},? \\d{4})',
              transform: 'date'
            },
            {
              // Doors/Show times sit in label+value pairs; the 2nd h2.mt-1 is
              // "Show Starts" (1st is "Doors Open", 3rd is "Ages").
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: 'h2.mt-1',
              index: 1,
              transform: 'time'
            },
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
              selector: '.performer_content_col .content p.mb-2',
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
      console.log('Updated existing Fitzgerald DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /fitzgerald/i } })

    const ds = await DataSourceModel.create({
      name: 'Fitzgerald Theater (first-avenue.com)',
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
    console.log('Created Fitzgerald DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
