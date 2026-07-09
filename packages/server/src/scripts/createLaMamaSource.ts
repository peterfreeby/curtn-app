import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — La MaMa Experimental Theatre Club, East Village.
// probeTemplate found .elementor-post (×16) on /now-playing/.
// Title cells contain "Show Name | May 1–May 17" — the regex strips the
// date range so only the show name is stored in title. Date/time data isn't
// on the listing page; admin fills in or approves at review time.
// Detail pages (linked via .elementor-post__thumbnail__link) carry full
// run info if a second-pass detail template is added later.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://lamama.org/now-playing/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.elementor-post',
          children: [
            {
              // Titles arrive as "Show Name | May 1–May 17".
              // Capture everything before the first | (trim removes trailing space).
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.elementor-post__title',
              regex: '^([^|]+)',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showDescription',
              csvField: 'showDescription',
              selector: '.elementor-post__excerpt',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: '.elementor-post__thumbnail__link',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showImageUrl',
              csvField: 'showImageUrl',
              selector: '.attachment-large',
              attribute: 'src',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'La MaMa Experimental Theatre Club',
    venueAddress: '74 E 4th St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10003'
  },
  maxItems: 30,
  // lamama.org posters hotlink-protect (render broken cross-origin on Curtn —
  // the image_hosting_error flag). Rehost each to R2 so it serves cleanly; a
  // failed rehost drops the field rather than staging a broken link.
  rehostImages: true
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
      existing.name = 'La MaMa (lamama.org)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated La MaMa DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /la mama/i } })

    const ds = await DataSourceModel.create({
      name: 'La MaMa (lamama.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created La MaMa DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing La MaMa venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
