import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import { runScraper } from '../services/scraping/runScraper'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// One-shot validation: pick three Tier 1 (JSON-LD) venues from the probe
// results, create DataSources, run them in dry-run mode, and report field
// fill rates so we know whether the JSON-LD path actually yields the dense
// data Curtn needs (cast, posters, run dates, descriptions, venue address).

interface Tier1Target {
  name: string
  programmingUrl: string
  venueNameForMatch: string
}

const TARGETS: Tier1Target[] = [
  {
    name: 'New York Comedy Club',
    programmingUrl: 'https://newyorkcomedyclub.com/calendar',
    venueNameForMatch: 'New York Comedy Club'
  },
  {
    name: 'Long Beach Playhouse',
    programmingUrl: 'https://lbplayhouse.org/shows/',
    venueNameForMatch: 'Long Beach Playhouse'
  },
  {
    name: 'Gibney',
    programmingUrl: 'https://gibneydance.org/calendar/',
    venueNameForMatch: 'Gibney'
  }
]

// Fields the importEngine cares about for richness analysis. Subset of
// CsvRowInput — these are what the JSON-LD extractor can populate.
const TRACKED_FIELDS = [
  'title',
  'date',
  'time',
  'ticketUrl',
  'showImageUrl',
  'showDescription',
  'performanceType',
  'venueName',
  'venueAddress',
  'venueCity',
  'venueState',
  'venueZipCode',
  'personName',
  'creditType',
  'runStartDate',
  'runEndDate'
]

async function ensureDataSource(target: Tier1Target, adminId: mongoose.Types.ObjectId): Promise<string> {
  const config: ScraperDataSourceConfig = {
    startUrl: target.programmingUrl,
    strategy: { mode: 'json-ld' }
  }

  const existing = await DataSourceModel.findOne({
    type: 'scraper',
    url: target.programmingUrl
  })
  if (existing) {
    existing.config = config as unknown as Record<string, any>
    existing.consecutiveFailures = 0
    existing.disabledReason = undefined
    existing.isActive = true
    await existing.save()
    return existing._id.toString()
  }

  const venue = await VenueModel.findOne({
    name: { $regex: new RegExp(`^${target.venueNameForMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
  })

  const ds = await DataSourceModel.create({
    name: `${target.name} (Tier 1 validation)`,
    type: 'scraper',
    url: target.programmingUrl,
    config: config as unknown as Record<string, any>,
    associatedVenue: venue?._id,
    createdBy: adminId,
    isActive: true,
    consecutiveFailures: 0,
    cooldownHours: 24
  })
  return ds._id.toString()
}

function fieldFillRates(rows: any[]): Record<string, { count: number; rate: number; sample?: string }> {
  const result: Record<string, { count: number; rate: number; sample?: string }> = {}
  for (const f of TRACKED_FIELDS) {
    let filled = 0
    let firstSample: string | undefined
    for (const r of rows) {
      const v = r[f]
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        filled++
        if (!firstSample) firstSample = String(v).slice(0, 80)
      }
    }
    result[f] = {
      count: filled,
      rate: rows.length > 0 ? filled / rows.length : 0,
      sample: firstSample
    }
  }
  return result
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found')

    for (const target of TARGETS) {
      console.log('\n' + '='.repeat(70))
      console.log(`VENUE: ${target.name}`)
      console.log(`URL:   ${target.programmingUrl}`)
      console.log('='.repeat(70))

      const sourceId = await ensureDataSource(target, admin._id as mongoose.Types.ObjectId)
      console.log(`DataSource: ${sourceId}`)

      try {
        const result = await runScraper({
          dataSourceId: sourceId,
          userId: admin._id.toString(),
          mode: 'dry-run',
          force: true,
          useCache: true
        })

        console.log(`\nRows extracted: ${result.rowsExtracted}`)
        console.log(`Rows valid:     ${result.rowsValid}`)

        const rows = result.rows || []
        if (rows.length === 0) {
          console.log('No rows — skipping fill-rate analysis')
          continue
        }

        const rates = fieldFillRates(rows)
        console.log('\nField fill rates:')
        for (const [f, info] of Object.entries(rates)) {
          const pct = (info.rate * 100).toFixed(0).padStart(3)
          const bar = '█'.repeat(Math.round(info.rate * 20))
          const sample = info.sample ? ` "${info.sample}"` : ''
          console.log(`  ${f.padEnd(20)} ${pct}% [${bar.padEnd(20)}] ${info.count}/${rows.length}${sample}`)
        }

        console.log('\nSample row (first):')
        console.log(JSON.stringify(rows[0], null, 2))
      } catch (err) {
        console.error('Scrape failed:', err instanceof Error ? err.message : String(err))
      }
    }
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
