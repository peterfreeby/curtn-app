import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { OgFallbackConfig } from '../services/ogFetch'

// Create/update the OG-fallback DataSource for The Public Theater (rung 4 of
// the blocked-venue ladder). The Public walls every content surface and
// verifies bots by IP, so we discover show URLs from its (reachable) homepage
// and fetch OG stubs via the FB Graph API. See:
//   Curtn_Obsidian/Reference/Handling Blocked Venues.md
//   Curtn_Obsidian/Projects/OG Fallback Ingestion (Facebook Graph API).md
//
// Idempotent — re-run to apply config edits. Run the source with:
//   npx ts-node src/scripts/runOgFallback.ts <dataSourceId> --dry-run

// Nominal source identity (the Public's current season). Discovery actually
// harvests from the homepage, which clears Cloudflare where the season page
// doesn't.
const SOURCE_URL = 'https://publictheater.org/productions/your-2526-season/'

const PUBLIC_OG_CONFIG: OgFallbackConfig = {
  kind: 'og-fallback',
  venueName: 'The Public Theater',
  performanceTypes: 'theater',
  venueAddress: '425 Lafayette Street',
  venueCity: 'New York',
  venueState: 'NY',
  venueZipCode: '10003',
  titleSuffixes: [' | The Public Theater', ' - The Public Theater'],
  discovery: {
    url: 'https://publictheater.org/',
    linkPattern: '/productions/season/'
  }
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found — run setAdmin first')

    const existing = await DataSourceModel.findOne({ type: 'api', url: SOURCE_URL })
    if (existing) {
      existing.config = PUBLIC_OG_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Public Theater OG source:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /^the public theater$/i } })
    const ds = await DataSourceModel.create({
      name: 'The Public Theater (OG fallback)',
      type: 'api',
      url: SOURCE_URL,
      config: PUBLIC_OG_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Public Theater OG source:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
