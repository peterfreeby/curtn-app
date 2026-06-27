import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) + JSON-LD detail-follow — Alvin Ailey American Dance Theater.
// ailey.org/performances lists shows as EventCards (Next.js hashed classes) that
// link to /events/<slug>. Each detail page carries an Event JSON-LD
// (name/startDate+time/location/description) — Ailey's NYC seasons play at BAM
// and NY City Center, so the JSON-LD location.name (the host venue) wins over the
// rowDefault. Layer og:image for the poster (JSON-LD image can be incomplete).
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
          selector: 'a[href*="/events/"]',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: ':scope',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: ':scope',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    jsonLd: true, // name/startDate(date+time)/location/description from the Event JSON-LD
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
  maxItems: 40
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
