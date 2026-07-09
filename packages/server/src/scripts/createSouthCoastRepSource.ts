import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 1 (JSON-LD) — South Coast Repertory, Costa Mesa CA.
// probeSeedList found 5 TheaterEvent at root scr.org. Three stages: Segerstrom,
// Julianne Argyros, Nicholas Studio. OC-based but tier-1 regional.

export const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.scr.org/',
  strategy: { mode: 'json-ld' },
  rowDefaults: {
    venueName: 'South Coast Repertory',
    venueAddress: '655 Town Center Dr',
    venueCity: 'Costa Mesa',
    venueState: 'CA',
    venueZipCode: '92626'
  },
  // "Cursed" (2026) had no JSON-LD image OR description while every other show
  // did. Gap-fill both the poster (og:image) and the blurb (og:description) from
  // the detail page ONLY when the listing lacks them (fillIfEmpty), so we never
  // override the good JSON-LD values on the other shows.
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    fillIfEmpty: ['showImageUrl', 'showDescription'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Poster + blurb fallback',
          selector: 'head',
          children: [
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: 'meta[property="og:image"]', attribute: 'content', transform: 'trim' },
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
      existing.name = 'South Coast Repertory (scr.org)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated South Coast Rep DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /south coast rep/i } })

    const ds = await DataSourceModel.create({
      name: 'South Coast Repertory (scr.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created South Coast Rep DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

if (require.main === module) main().catch(err => { console.error(err); process.exit(1) })
