import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Boston Court Pasadena (bostoncourtpasadena.org) — WordPress; events render on
// the homepage (.event-content), no /events archive. DRAFT for triage dry-run.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://bostoncourtpasadena.org/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.event-content',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: 'h2', transform: 'trim' },
            { type: 'field', id: 'date', csvField: 'date', selector: 'h3', transform: 'date' },
            { type: 'field', id: 'description', csvField: 'showDescription', selector: 'i', transform: 'trim' },
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: 'img', attribute: 'src', transform: 'trim' },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: 'a[href]', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Boston Court Pasadena',
    venueAddress: '70 N Mentor Ave',
    venueCity: 'Pasadena',
    venueState: 'CA',
    venueZipCode: '91106'
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
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Boston Court DataSource:', existing._id.toString())
      return
    }
    const venue = await VenueModel.findOne({ name: { $regex: /boston court/i } })
    const ds = await DataSourceModel.create({
      name: 'Boston Court Pasadena (bostoncourtpasadena.org)',
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
    console.log('Created Boston Court DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
