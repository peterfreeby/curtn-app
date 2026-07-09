import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Birdland (birdlandjazz.com), Hell's Kitchen — jazz + cabaret theater. The
// homepage embeds a TicketWeb widget: each .tw-section is an event with title
// (.tw-name a → /tm-event/<slug>), poster (.event-img), and date (.tw-event-date
// "Jun 6"). The site blocks plain HTTP (Cloudflare) but renders under the
// scraper's headless browser. Listing has no synopsis, so detail-fetch pulls the
// og:description from each /tm-event page; the /tm-event page (TicketWeb buy flow)
// is the canonical ticket URL.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.birdlandjazz.com/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.tw-section',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.tw-name', transform: 'trim' },
            { type: 'field', id: 'date', csvField: 'date', selector: '.tw-event-date', transform: 'date' },
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: '.event-img', attribute: 'src', transform: 'trim' },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: '.tw-name a', attribute: 'href', transform: 'trim' },
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: '.tw-name a', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Birdland',
    venueAddress: '315 W 44th St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10036',
    performanceTypes: 'cabaret'
  },
  maxItems: 50,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    // birdlandjazz.com sits behind Cloudflare; reusing one page across every
    // /tm-event fetch let the session degrade so a couple of og:description reads
    // came back empty (the missing_description flags). A fresh context per fetch
    // keeps each detail read clean.
    freshContextPerFetch: true,
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
      console.log('Updated existing Birdland DataSource:', existing._id.toString())
      return
    }
    const venue = await VenueModel.findOne({ name: { $regex: /birdland/i } })
    const ds = await DataSourceModel.create({
      name: 'Birdland (birdlandjazz.com)',
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
    console.log('Created Birdland DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
