import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 1 (JSON-LD) — Heidi Duckler Dance, LA-based itinerant company.
// probeSeedList found 1 Event — weak signal at probe time. Site-specific and
// community-based; productions happen at varied venues. No rowDefaults since
// they're itinerant and each event has its own location.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://heididuckler.org/',
  strategy: { mode: 'json-ld' }
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
      existing.name = 'Heidi Duckler Dance (heididuckler.org)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Heidi Duckler Dance DataSource:', existing._id.toString())
      return
    }

    const ds = await DataSourceModel.create({
      name: 'Heidi Duckler Dance (heididuckler.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Heidi Duckler Dance DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
