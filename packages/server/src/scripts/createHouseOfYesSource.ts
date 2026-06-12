import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// House of Yes (houseofyes.org), Bushwick — queer variety/burlesque. The
// /calendar page embeds a Shotgun ticketing widget; each event is an
// <a.shotgun-event-card> (the card IS the link) to shotgun.live/events/<slug>,
// carrying title (.events-listing-event-name), date (.sg-text-accent-foreground
// "Sat, Jun 6" → current year), and a Cloudinary poster. The shotgun.live event
// page is the canonical ticket URL; its og:description is the synopsis.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://houseofyes.org/calendar',
  waitFor: '.shotgun-event-card',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.shotgun-event-card',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.events-listing-event-name', transform: 'trim' },
            { type: 'field', id: 'date', csvField: 'date', selector: '.sg-text-accent-foreground', transform: 'date' },
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: 'img', attribute: 'src', transform: 'trim' },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: ':scope', attribute: 'href', transform: 'trim' },
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: ':scope', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'House of Yes',
    venueAddress: '2 Wyckoff Ave',
    venueCity: 'Brooklyn',
    venueState: 'NY',
    venueZipCode: '11237',
    performanceTypes: 'burlesque'
  },
  maxItems: 60,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title', 'date'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Event detail',
          selector: 'html',
          children: [
            { type: 'field', id: 'desc', csvField: 'showDescription', selector: 'meta[property="og:description"]', attribute: 'content', transform: 'trim' }
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
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing House of Yes DataSource:', existing._id.toString())
      return
    }
    const venue = await VenueModel.findOne({ name: { $regex: /house of yes/i } })
    const ds = await DataSourceModel.create({
      name: 'House of Yes (houseofyes.org)',
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
    console.log('Created House of Yes DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
