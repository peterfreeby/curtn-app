import '../config/env'
import mongoose from 'mongoose'
import { PendingImportModel } from '../entities/pendingImport/pendingImportModel'
import { RunModel } from '../entities/run/runModel'
import { PerformanceModel } from '../entities/performance/performanceModel'
import { CreditModel } from '../entities/credit/creditModel'
import { ShowModel } from '../entities/show/showModel'
import { UserModel } from '../entities/user/userModel'
import { promoteToRecords } from '../entities/pendingImport/mutations/reviewPendingImport'

// Validation: promote a few "Best of Brooklyn Stand-Up Comedy" PendingImports
// (recurring showcase, different lineup per night) and verify the run is
// flagged variable-lineup and each performance shows ONLY its own lineup —
// not the union of every night. Repro for [[Per-Performance Cast Attribution]].
//
// Idempotent-ish: deletes the test Show/Run/Performances/Credits for this
// title first so re-runs start clean. Scoped strictly to the test title.

const TITLE = 'Best of Brooklyn Stand-Up Comedy'

async function resetTestData() {
  const shows = await ShowModel.find({ title: new RegExp(`^${TITLE}$`, 'i') })
  for (const show of shows) {
    const runs = await RunModel.find({ show: show._id })
    for (const run of runs) {
      await PerformanceModel.deleteMany({ run: run._id })
      await CreditModel.deleteMany({ run: run._id })
    }
    await RunModel.deleteMany({ show: show._id })
    await show.deleteOne()
  }
}

async function effectiveCastFor(performance: any): Promise<string[]> {
  // Mirror the resolver logic without GraphQL ctx/loaders.
  const run = await RunModel.findById(performance.run)
  let defaultCast: any[]
  if (run?.lineupPerPerformance) {
    defaultCast = []
  } else {
    defaultCast = await CreditModel.find({ run: performance.run, creditType: 'cast' }).populate('person')
  }
  let result = [...defaultCast]
  if (performance.creditOverrides) {
    const removed = new Set((performance.creditOverrides.removed || []).map((id: any) => id.toString()))
    result = result.filter((c: any) => !removed.has(c._id.toString()))
    if (performance.creditOverrides.added?.length) {
      const added = await CreditModel.find({ _id: { $in: performance.creditOverrides.added } }).populate('person')
      result = [...result, ...added]
    }
  }
  return result.map((c: any) => c.person?.name).filter(Boolean)
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user')

    await resetTestData()
    console.log(`Reset test data for "${TITLE}"\n`)

    const pis = await PendingImportModel.find({ title: new RegExp(`^${TITLE}$`, 'i') })
      .sort({ date: 1 })
      .limit(3)
      .lean()

    if (pis.length < 2) {
      console.log(`Need >=2 PendingImports to test (found ${pis.length}). Re-stage Tiny Cupboard first.`)
      return
    }

    for (const pi of pis) {
      const date = pi.date ? new Date(pi.date).toISOString().slice(0, 10) : '(no date)'
      const castNames = (pi.cast || []).map((c: any) => c.name)
      console.log(`Promoting ${date} — lineup (${castNames.length}): ${castNames.slice(0, 5).join(', ')}${castNames.length > 5 ? ' …' : ''}`)
      await promoteToRecords(pi, admin._id.toString())
    }

    console.log('')
    const show = await ShowModel.findOne({ title: new RegExp(`^${TITLE}$`, 'i') })
    const run = await RunModel.findOne({ show: show!._id })
    console.log(`Show: ${show!.title}`)
    console.log(`Show.performanceTypes: ${JSON.stringify(show!.performanceTypes)}`)
    console.log(`Run.lineupPerPerformance: ${run!.lineupPerPerformance}  ${run!.lineupPerPerformance ? '✓ (variable-lineup detected)' : '✗ (treated as fixed-cast — BUG)'}`)

    const perfs = await PerformanceModel.find({ run: run!._id }).sort({ date: 1 })
    console.log(`\nPerformances: ${perfs.length}`)
    let allIdentical = true
    let firstSig = ''
    for (let i = 0; i < perfs.length; i++) {
      const p = perfs[i]
      const cast = await effectiveCastFor(p)
      const date = p.date ? new Date(p.date).toISOString().slice(0, 10) : '?'
      const sig = cast.slice().sort().join('|')
      if (i === 0) firstSig = sig
      else if (sig !== firstSig) allIdentical = false
      console.log(`  ${date}: effectiveCast (${cast.length}) = ${cast.slice(0, 6).join(', ')}${cast.length > 6 ? ' …' : ''}`)
    }

    console.log('')
    if (perfs.length >= 2 && allIdentical) {
      console.log('✗ FAIL — every performance shows an identical cast (the union bug is still present)')
    } else if (perfs.length >= 2) {
      console.log('✓ PASS — each performance shows its own distinct lineup')
    }
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
