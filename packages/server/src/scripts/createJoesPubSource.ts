import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { OgFallbackConfig } from '../services/ogFetch'

// Joe's Pub (inside The Public Theater) — OG-fallback (rung 4), same as the
// Public Theater source. publictheater.org is a heavy Cloudflare/JS site: the
// /programs/joes-pub page renders show cards reliably enough to DISCOVER show
// URLs (/performances-jp/...), but a CSS template over it is flaky (cards render
// late; detail pages never reach networkidle) and the per-show synopsis only
// comes back cleanly via the FB Graph API OG stub. So we discover from the
// program page and fetch OG (title/image/description) for each show.

const SOURCE_URL = 'https://publictheater.org/programs/joes-pub/'

const JOES_PUB_OG_CONFIG: OgFallbackConfig = {
  kind: 'og-fallback',
  venueName: "Joe's Pub",
  performanceTypes: 'cabaret',
  venueAddress: '425 Lafayette Street',
  venueCity: 'New York',
  venueState: 'NY',
  venueZipCode: '10003',
  titleSuffixes: [" | Joe's Pub", ' | The Public Theater', ' - The Public Theater'],
  discovery: {
    url: 'https://publictheater.org/programs/joes-pub/',
    linkPattern: '/performances-jp/'
  }
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found — run setAdmin first')

    // Deactivate any earlier template-based scraper source for the same page.
    const oldTemplate = await DataSourceModel.findOne({ type: 'scraper', url: SOURCE_URL })
    if (oldTemplate) {
      oldTemplate.isActive = false
      oldTemplate.disabledReason = 'superseded by OG-fallback source (template flaky on publictheater.org)'
      await oldTemplate.save()
      console.log('Deactivated old template Joe’s Pub source:', oldTemplate._id.toString())
    }

    const existing = await DataSourceModel.findOne({ type: 'api', url: SOURCE_URL })
    if (existing) {
      existing.config = JOES_PUB_OG_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log("Updated existing Joe's Pub OG source:", existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /joe'?s pub/i } })
    const ds = await DataSourceModel.create({
      name: "Joe's Pub (OG fallback)",
      type: 'api',
      url: SOURCE_URL,
      config: JOES_PUB_OG_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log("Created Joe's Pub OG source:", ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
