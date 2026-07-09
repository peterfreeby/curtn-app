import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) + og detail-follow — Alvin Ailey American Dance Theater.
// ailey.org/performances lists each performance as an EventCard <article>. Each
// card holds FOUR anchors to the same /events/<slug> (date/time, image, title,
// "Learn More"); the old selector matched all four, so it staged junk rows
// titled "Sep 25 7:30PM" / "Learn More" (the wrong_title flag). We now walk the
// card <article> and read the real title, date, and time from it.
//
// Detail pages carry NO reliable Event JSON-LD (present on some engagements,
// absent on most — e.g. the LA / touring dates) and no rich body copy, so the
// description and poster come from the og: meta tags, which every /events page
// renders server-side. Hash-suffixed CSS-module classes are matched by prefix
// ([class*="EventCard_title"]) so a rebuild's new hash doesn't break us.
// Event maps to no performanceType, so force 'dance'.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://ailey.org/performances',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: 'article',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'a[class*="EventCard_title"]',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a[class*="EventCard_title"]',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '[class*="EventCard_dateSpan"]',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: '[class*="EventCard_time"]',
              transform: 'time'
            }
          ]
        }
      ]
    }
  },
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title', 'date'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Detail',
          selector: 'html',
          children: [
            {
              type: 'field',
              id: 'desc',
              csvField: 'showDescription',
              selector: 'meta[property="og:description"]',
              attribute: 'content',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'meta[property="og:image"]',
              attribute: 'content',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'poster2',
              csvField: 'performanceImageUrl',
              selector: 'meta[property="og:image"]',
              attribute: 'content',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Alvin Ailey American Dance Theater',
    venueAddress: '405 West 55th Street',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10019',
    performanceTypes: 'dance'
  },
  maxItems: 80
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
      existing.name = 'Alvin Ailey (ailey.org)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Alvin Ailey DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /alvin ailey/i } })

    const ds = await DataSourceModel.create({
      name: 'Alvin Ailey (ailey.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Alvin Ailey DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Alvin Ailey venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
