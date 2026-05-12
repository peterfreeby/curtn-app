/**
 * Backfill User anti-abuse fields for Phase 7.
 *
 *   - Sets `createdAt` from the ObjectId timestamp when missing.
 *   - Sets `editCount` to the count of (AuditLog + Proposal) rows authored by
 *     this User (kind === 'User').
 *   - Sets `firstEditAt` to the earliest of those rows; null if none.
 *   - Sets `autoconfirmedAchievedAt` to `firstEditAt` (or createdAt + 4d,
 *     whichever is later) when both thresholds are already crossed at runtime,
 *     so we don't fire `autoconfirmed_achieved` for users who already meet the
 *     bar at backfill time. (No notification is fired here.)
 *
 * Idempotent: safe to re-run; recomputes the totals each pass.
 *
 * Usage:
 *   npx tsnd --clear --transpile-only src/scripts/backfillUserAntiAbuse.ts
 */

import { Types } from 'mongoose'
import { connectToDatabase, disconnectFromDatabase } from '../db/mongoose'
import { UserModel } from '../entities/user/userModel'
import { AuditLogModel } from '../entities/auditLog/auditLogModel'
import { ProposalModel } from '../entities/proposal/proposalModel'
import { ANTI_ABUSE, ONE_DAY_MS } from '../permissions/antiAbuseConfig'

async function main() {
  await connectToDatabase()
  console.log('Connected to database\n')

  const users = await UserModel.find({}).select('_id createdAt').lean()
  console.log(`Backfilling anti-abuse fields for ${users.length} users...`)

  let updated = 0
  for (const u of users) {
    const uid = u._id as Types.ObjectId

    // createdAt — pull from ObjectId timestamp when missing.
    let createdAt = u.createdAt instanceof Date ? u.createdAt : null
    if (!createdAt) {
      createdAt = new Date(uid.getTimestamp())
    }

    // Pull author timestamps from both tables in parallel.
    const [auditRows, proposalRows] = await Promise.all([
      AuditLogModel.find({ 'author.kind': 'User', 'author.userId': uid })
        .select('createdAt').lean(),
      ProposalModel.find({ 'proposer.kind': 'User', 'proposer.userId': uid })
        .select('createdAt').lean(),
    ])

    const editCount = auditRows.length + proposalRows.length
    const allDates = [
      ...auditRows.map(r => r.createdAt).filter(Boolean),
      ...proposalRows.map(r => r.createdAt).filter(Boolean),
    ] as Date[]
    const firstEditAt = allDates.length > 0
      ? new Date(Math.min(...allDates.map(d => d.getTime())))
      : null

    // If they already meet the thresholds, mark autoconfirmedAchievedAt so we
    // don't fire the welcome notification post-hoc. Use the moment they could
    // first have qualified — max(firstEditAt, createdAt + 4d).
    let autoconfirmedAchievedAt: Date | null = null
    if (
      editCount >= ANTI_ABUSE.AUTOCONFIRMED_EDITS &&
      Date.now() - createdAt.getTime() >= ANTI_ABUSE.AUTOCONFIRMED_DAYS * ONE_DAY_MS
    ) {
      const earliestEligible = new Date(createdAt.getTime() + ANTI_ABUSE.AUTOCONFIRMED_DAYS * ONE_DAY_MS)
      autoconfirmedAchievedAt = firstEditAt && firstEditAt > earliestEligible ? firstEditAt : earliestEligible
    }

    await UserModel.updateOne({ _id: uid }, {
      $set: {
        createdAt,
        editCount,
        firstEditAt,
        autoconfirmedAchievedAt,
      },
    })
    updated += 1
  }

  console.log(`\nDone. Updated ${updated} users.`)
  await disconnectFromDatabase()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
