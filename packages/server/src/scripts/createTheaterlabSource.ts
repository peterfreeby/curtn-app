import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Theaterlab (theaterlabnyc.com) — WordPress, two-level scrape.
//
// Listing: /news/ ("NOW AND NEXT") renders one `article.post` per upcoming
// showing, each with a per-item poster `img`, and a `.post-title` whose text mashes
// program, title, and date: "Atelier @ Theaterlab | Third Spaces by Dylan Sherman
// | June 10-14, '26". The date is pulled by regex ("Month Day" → year inferred;
// range tails like "-14" dropped). The link → /<slug>/.
//
// Detail: the show page's first `h2` is the clean title ("THIRD SPACES"), with a
// show-specific OvationTix link and the synopsis in the content. No og tags.
//
// Notes:
//  - Small lab/residency venue (2 work-in-progress showings at a time).
//  - `time` left empty (per-performance times are in a prose schedule); range end
//    dropped (single anchor date), so multi-day showings stage one date — admin extends.

const TLAB_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://theaterlabnyc.com/news/',
  strategy: { mode: 'code', scraperId: 'theaterlab' }
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found — run setAdmin first')

    const existing = await DataSourceModel.findOne({
      type: 'scraper',
      url: TLAB_CONFIG.startUrl
    })
    if (existing) {
      existing.config = TLAB_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Theaterlab DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /theater\s*lab/i } })

    const ds = await DataSourceModel.create({
      name: 'Theaterlab (theaterlabnyc.com)',
      type: 'scraper',
      url: TLAB_CONFIG.startUrl,
      config: TLAB_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Theaterlab DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Theaterlab venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
