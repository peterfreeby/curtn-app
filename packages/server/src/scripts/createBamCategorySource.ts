import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// BAM per-category landing pages (theater/dance/opera/talks/performance-art).
// Distinct from /calendar — these pages render `.productionblock` cards for
// multi-day runs rather than the single-showtime `.eventBlock` cards.
//
// Usage:
//   npx ts-node createBamCategorySource.ts theater
//   npx ts-node createBamCategorySource.ts dance
//   npx ts-node createBamCategorySource.ts opera
//   npx ts-node createBamCategorySource.ts talks
//   npx ts-node createBamCategorySource.ts performance-art
//
// Each invocation creates (or updates) one DataSource pointing at /<category>.

const SUPPORTED_CATEGORIES = new Set([
  'theater', 'dance', 'opera', 'talks', 'performance-art'
])

function makeConfig(category: string): ScraperDataSourceConfig {
  return {
    startUrl: `https://www.bam.org/${category}`,
    strategy: {
      mode: 'template',
      template: {
        version: 2,
        nodes: [
          {
            type: 'container',
            id: 'productions',
            label: 'Productions',
            // Real productions use `.productionblock` alone; the `.block-layout-item`
            // class marks sponsor / info-only blocks we want to skip.
            selector: '.productionblock:not(.block-layout-item)',
            children: [
              {
                type: 'field',
                id: 'title',
                csvField: 'title',
                selector: ':scope',
                attribute: 'data-sort-title',
                transform: 'trim'
              },
              {
                // data-sort-date is "2025-10-22-00:00:00" — odd format, regex out
                // the YYYY-MM-DD portion so the date transform parses cleanly.
                type: 'field',
                id: 'date',
                csvField: 'date',
                selector: ':scope',
                attribute: 'data-sort-date',
                regex: '^(\\d{4}-\\d{2}-\\d{2})',
                transform: 'date'
              },
              {
                // Same start date but populated into runStartDate for multi-day
                // runs. Stage helper picks this up alongside `date`.
                type: 'field',
                id: 'runStart',
                csvField: 'runStartDate',
                selector: ':scope',
                attribute: 'data-sort-date',
                regex: '^(\\d{4}-\\d{2}-\\d{2})',
                transform: 'date'
              },
              {
                // Genre badge — "Theater", "Dance | Theater", etc. The first
                // entry before any pipe is the primary genre.
                type: 'field',
                id: 'genre',
                csvField: 'performanceTypes',
                selector: ':scope',
                attribute: 'data-sort-genre',
                regex: '^([^|]+)',
                transform: 'trim'
              },
              {
                type: 'field',
                id: 'description',
                csvField: 'showDescription',
                selector: '.bam-block-2x2-hover-content-body',
                transform: 'trim'
              },
              {
                type: 'field',
                id: 'ticketUrl',
                csvField: 'ticketUrl',
                selector: 'a.btn',
                attribute: 'href',
                transform: 'trim'
              },
              {
                type: 'field',
                id: 'image',
                csvField: 'showImageUrl',
                selector: 'picture img',
                attribute: 'src',
                transform: 'trim'
              }
            ]
          }
        ]
      }
    },
    rowDefaults: {
      venueName: 'BAM',
      venueAddress: '30 Lafayette Ave',
      venueCity: 'Brooklyn',
      venueState: 'NY',
      venueZipCode: '11217'
    },
    maxItems: 50
  }
}

async function main() {
  const category = process.argv[2]
  if (!category || !SUPPORTED_CATEGORIES.has(category)) {
    console.error(`Usage: createBamCategorySource.ts <category>`)
    console.error(`Supported: ${Array.from(SUPPORTED_CATEGORIES).join(', ')}`)
    process.exit(1)
  }

  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found')

    const config = makeConfig(category)
    const venue = await VenueModel.findOne({ name: { $regex: /^bam$/i } })
      || await VenueModel.findOne({ name: { $regex: /brooklyn academy/i } })

    const existing = await DataSourceModel.findOne({
      type: 'scraper',
      url: config.startUrl
    })
    if (existing) {
      existing.config = config
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log(`Updated BAM ${category} DataSource:`, existing._id.toString())
      return
    }

    const ds = await DataSourceModel.create({
      name: `BAM ${category} (bam.org/${category})`,
      type: 'scraper',
      url: config.startUrl,
      config,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log(`Created BAM ${category} DataSource:`, ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
