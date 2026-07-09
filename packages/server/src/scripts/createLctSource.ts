import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — Lincoln Center Theater, Lincoln Center Plaza.
// Container: .center ×7 on /shows/. Title via a.title (also the detail URL).
// No dates on listing page — admin fills in at review.
// No <img> tags in cards (images may be CSS backgrounds not captured here).
// waitFor: '.center' — JS-rendered; wait for first show card.
//
// Note: LCT operates multiple spaces (Vivian Beaumont, Mitzi Newhouse, Claire Tow).
// rowDefaults uses the main Beaumont address; admin can correct per-show.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.lct.org/shows/',
  waitFor: '.center',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.center',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'a.title',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showDescription',
              csvField: 'showDescription',
              selector: '.teaser',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a.learn-more',
              attribute: 'href',
              transform: 'trim'
            },
            {
              // Card title link doubles as the /shows/<slug>/ detail URL.
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a.title',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Lincoln Center Theater',
    venueAddress: '150 W 65th St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10023'
  },
  maxItems: 20,
  // Listing cards carry only the LCT3 logo SVG (no poster). Each /shows/<slug>/
  // detail page has the real poster in og:image — but LCT's tag is malformed:
  // it prepends "http://www.lct.org" to an already-absolute media.lct.org URL
  // ("http://www.lct.orghttps://media.lct.org/..."), which renders broken
  // (image_hosting_error). Regex-extract the clean, valid media.lct.org URL.
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Poster',
          selector: 'html',
          children: [
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'meta[property="og:image"], meta[name="og:image"]',
              attribute: 'content',
              regex: '(https://media\\.lct\\.org/\\S+)',
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
    if (!admin) throw new Error('No admin user found')

    const existing = await DataSourceModel.findOne({ type: 'scraper', url: CONFIG.startUrl })
    if (existing) {
      existing.name = 'Lincoln Center Theater (lct.org)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated LCT DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /lincoln center theater/i } })

    const ds = await DataSourceModel.create({
      name: 'Lincoln Center Theater (lct.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created LCT DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing LCT venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
