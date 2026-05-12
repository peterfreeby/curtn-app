import { Types } from 'mongoose'
import { UserModel } from '../../entities/user/userModel'
import { ANTI_ABUSE, ONE_DAY_MS } from '../../permissions/antiAbuseConfig'
import { createNotification } from '../notifications/createNotification'

// Phase 7 — single entry point for bumping a user's edit signal. Called from
// every write path that produces a Proposal (createProposal) or an AuditLog
// row (writeAuditLog) attributed to a User author. Maintains:
//   - User.editCount (denormalized total — Proposal + AuditLog rows authored)
//   - User.firstEditAt (set once on first edit)
//   - User.autoconfirmedAchievedAt (set once when both thresholds are crossed;
//     also fires the `autoconfirmed_achieved` notification)
//
// Idempotent on the achievement notification because the once-set `autoconfirmedAchievedAt`
// guards the fire.

export async function incrementEditActivity(userId: Types.ObjectId | string | null | undefined): Promise<void> {
  if (!userId) return
  const uid = typeof userId === 'string' ? new Types.ObjectId(userId) : userId

  const now = new Date()

  // Atomic increment + firstEditAt set-on-null. We pull the updated doc back to
  // decide whether to fire the autoconfirmed notification.
  const updated = await UserModel.findByIdAndUpdate(
    uid,
    {
      $inc: { editCount: 1 },
      $set: {
        // setOnInsert won't fire for an existing user; we need a conditional
        // update. Two writes: increment first, then only set firstEditAt if
        // it's still null.
      },
    },
    { new: true, projection: { editCount: 1, firstEditAt: 1, createdAt: 1, autoconfirmedAchievedAt: 1 } },
  ).lean()

  if (!updated) return

  if (!updated.firstEditAt) {
    await UserModel.updateOne(
      { _id: uid, firstEditAt: null },
      { $set: { firstEditAt: now } },
    )
  }

  // Already achieved → nothing more to do.
  if (updated.autoconfirmedAchievedAt) return

  const editCount = updated.editCount ?? 0
  if (editCount < ANTI_ABUSE.AUTOCONFIRMED_EDITS) return

  const created = updated.createdAt instanceof Date
    ? updated.createdAt.getTime()
    : new Date(updated.createdAt as any).getTime()
  if (!Number.isFinite(created)) return
  if (Date.now() - created < ANTI_ABUSE.AUTOCONFIRMED_DAYS * ONE_DAY_MS) return

  // Crossed the threshold for the first time. Race-safe via the filter:
  // only the first writer flips autoconfirmedAchievedAt and fires the notification.
  const fired = await UserModel.updateOne(
    { _id: uid, autoconfirmedAchievedAt: null },
    { $set: { autoconfirmedAchievedAt: now } },
  )
  if (fired.modifiedCount === 1) {
    await createNotification({
      recipient: uid,
      kind: 'autoconfirmed_achieved',
      context: {
        editCount,
        thresholdEdits: ANTI_ABUSE.AUTOCONFIRMED_EDITS,
        thresholdDays: ANTI_ABUSE.AUTOCONFIRMED_DAYS,
      },
    })
  }
}
