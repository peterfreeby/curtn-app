/**
 * Migration: Split old Performance documents into Show/Run/Performance (three-tier)
 *
 * For each old Performance document:
 * 1. Create a Show from { title, description, performanceTypes, duration, languages, wikidataId }
 * 2. Upsert a ProductionCompany from company.name
 * 3. Create a Run linking Show + ProductionCompany + venues + intermissions
 * 4. Create individual Performance docs from each performances[] item
 * 5. Update Reviews: set run field, match performance to closest new Performance by date
 *
 * Run: npx ts-node packages/server/src/scripts/migrateToShowRunPerformance.ts
 */

import mongoose, { Types } from 'mongoose'
import { connectToDatabase, disconnectFromDatabase } from '../db/mongoose'

// We need direct collection access since the old Performance schema no longer matches the model
async function migrate() {
  await connectToDatabase()
  const db = mongoose.connection.db
  if (!db) throw new Error('No database connection')

  // Access collections directly
  const oldPerformances = db.collection('performances')
  const shows = db.collection('shows')
  const runs = db.collection('runs')
  const newPerformances = db.collection('newperformances') // temporary collection
  const productionCompanies = db.collection('productioncompanies')
  const reviews = db.collection('reviews')

  const allOldPerfs = await oldPerformances.find({}).toArray()
  console.log(`Found ${allOldPerfs.length} old Performance documents to migrate`)

  const companyCache = new Map<string, Types.ObjectId>() // name -> _id
  let showCount = 0
  let runCount = 0
  let perfCount = 0
  let reviewsUpdated = 0

  for (const oldPerf of allOldPerfs) {
    // 1. Create Show
    const showDoc = {
      title: oldPerf.title,
      description: oldPerf.description,
      performanceTypes: oldPerf.performanceTypes,
      duration: oldPerf.duration,
      languages: oldPerf.languages || ['English'],
      wikidataId: oldPerf.wikidataId,
      submittedBy: oldPerf.submittedBy,
      createdAt: oldPerf.createdAt || new Date(),
      updatedAt: oldPerf.updatedAt || new Date()
    }
    const showResult = await shows.insertOne(showDoc)
    const showId = showResult.insertedId
    showCount++

    // 2. Upsert ProductionCompany
    const companyName = oldPerf.company?.name || 'Unknown Company'
    let companyId: Types.ObjectId
    if (companyCache.has(companyName)) {
      companyId = companyCache.get(companyName)!
    } else {
      const slug = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

      const existing = await productionCompanies.findOne({ slug })
      if (existing) {
        companyId = existing._id as Types.ObjectId
      } else {
        const companyResult = await productionCompanies.insertOne({
          name: companyName,
          slug,
          description: oldPerf.company?.description,
          wikidataId: oldPerf.company?.wikidataId,
          submittedBy: oldPerf.submittedBy,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        companyId = companyResult.insertedId as Types.ObjectId
      }
      companyCache.set(companyName, companyId)
    }

    // 3. Create Run
    const runDoc = {
      show: showId,
      productionCompany: companyId,
      venues: oldPerf.venues || [],
      intermissions: oldPerf.intermissions || 0,
      description: oldPerf.company?.description,
      wikidataId: oldPerf.wikidataId,
      eventbriteId: oldPerf.eventbriteId,
      submittedBy: oldPerf.submittedBy,
      createdAt: oldPerf.createdAt || new Date(),
      updatedAt: oldPerf.updatedAt || new Date()
    }

    // Set start/end date from performances array
    const perfDates = (oldPerf.performances || [])
      .map((p: any) => new Date(p.date))
      .filter((d: Date) => !isNaN(d.getTime()))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime())

    if (perfDates.length > 0) {
      ;(runDoc as any).startDate = perfDates[0]
      ;(runDoc as any).endDate = perfDates[perfDates.length - 1]
    }

    const runResult = await runs.insertOne(runDoc)
    const runId = runResult.insertedId
    runCount++

    // 4. Create individual Performance docs from performances[]
    const perfIdMap: { date: Date, newId: Types.ObjectId }[] = []
    for (const showing of (oldPerf.performances || [])) {
      const perfDoc = {
        run: runId,
        date: showing.date,
        time: showing.time,
        venueId: showing.venueId,
        ticketUrl: showing.ticketUrl,
        eventbriteId: showing.eventbriteId,
        soldOut: showing.soldOut || false,
        submittedBy: oldPerf.submittedBy,
        createdAt: oldPerf.createdAt || new Date(),
        updatedAt: oldPerf.updatedAt || new Date()
      }
      const perfResult = await newPerformances.insertOne(perfDoc)
      perfIdMap.push({ date: new Date(showing.date), newId: perfResult.insertedId as Types.ObjectId })
      perfCount++
    }

    // 5. Update Reviews referencing this old Performance
    const relatedReviews = await reviews.find({ performance: oldPerf._id }).toArray()
    for (const review of relatedReviews) {
      // Find closest new Performance by date
      let bestMatch: Types.ObjectId | null = null
      let bestDiff = Infinity

      const reviewDate = review.performanceDate ? new Date(review.performanceDate) : review.attendedAt ? new Date(review.attendedAt) : null

      if (reviewDate && perfIdMap.length > 0) {
        for (const { date, newId } of perfIdMap) {
          const diff = Math.abs(date.getTime() - reviewDate.getTime())
          if (diff < bestDiff) {
            bestDiff = diff
            bestMatch = newId
          }
        }
      }

      // If no date match, use the first performance
      if (!bestMatch && perfIdMap.length > 0) {
        bestMatch = perfIdMap[0].newId
      }

      const updateFields: any = { run: runId }
      if (bestMatch) {
        updateFields.performance = bestMatch
      }

      await reviews.updateOne({ _id: review._id }, { $set: updateFields })
      reviewsUpdated++
    }
  }

  // 6. Rename collections: drop old performances, rename newperformances to performances
  console.log('\n--- Migration Summary ---')
  console.log(`Shows created: ${showCount}`)
  console.log(`Runs created: ${runCount}`)
  console.log(`Performances created: ${perfCount}`)
  console.log(`Production Companies created: ${companyCache.size}`)
  console.log(`Reviews updated: ${reviewsUpdated}`)

  console.log('\nRenaming collections...')
  // Back up old performances
  await oldPerformances.rename('performances_backup')
  // Rename new performances to performances
  await newPerformances.rename('performances')
  console.log('Done! Old performances backed up to performances_backup collection.')

  await disconnectFromDatabase()
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
