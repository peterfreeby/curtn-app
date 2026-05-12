import { Types } from 'mongoose'
import { BlockModel } from '../../entities/block/blockModel'
import { UserModel } from '../../entities/user/userModel'
import { NotificationModel } from '../../entities/notification/notificationModel'
import { ANTI_ABUSE, ONE_DAY_MS } from '../../permissions/antiAbuseConfig'
import { createNotification } from '../notifications/createNotification'

// Phase 7 — daily block-volume check. Finds claimants whose block count in
// the last N days exceeds the threshold, then fires `high_block_volume_alert`
// to every admin User. Idempotency: skips firing again for a given (blocker,
// windowStart-day) if a notification with the same blocker context already
// exists in the same trailing window. Acceptable to be loose — if we double-
// alert occasionally, admins de-dupe by inspection.

export interface BlockVolumeCheckResult {
  scanned: number
  flagged: number
  notificationsCreated: number
}

export async function processBlockVolumeCheck(): Promise<BlockVolumeCheckResult> {
  const windowMs = ANTI_ABUSE.BLOCK_VOLUME_ALERT_WINDOW_DAYS * ONE_DAY_MS
  const since = new Date(Date.now() - windowMs)

  const grouped = await BlockModel.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: '$blocker', blockCount: { $sum: 1 } } },
    { $match: { blockCount: { $gt: ANTI_ABUSE.BLOCK_VOLUME_ALERT_THRESHOLD } } },
  ])

  if (grouped.length === 0) {
    return { scanned: 0, flagged: 0, notificationsCreated: 0 }
  }

  const admins = await UserModel.find({ isAdmin: true }).select('_id').lean()
  if (admins.length === 0) {
    return { scanned: grouped.length, flagged: grouped.length, notificationsCreated: 0 }
  }

  let notificationsCreated = 0
  for (const row of grouped) {
    const blockerId = row._id as Types.ObjectId
    if (!blockerId) continue

    // De-dup: skip if any admin already has a recent (within window) alert for
    // this blocker. We check just one to keep this cheap.
    const existing = await NotificationModel.findOne({
      kind: 'high_block_volume_alert',
      'context.blockerId': blockerId.toString(),
      createdAt: { $gte: since },
    }).select('_id').lean()
    if (existing) continue

    const blockerUser: any = await UserModel.findById(blockerId).select('username fullName').lean()

    for (const admin of admins) {
      await createNotification({
        recipient: admin._id,
        kind: 'high_block_volume_alert',
        context: {
          blockerId: blockerId.toString(),
          blockerUsername: blockerUser?.username ?? null,
          blockerFullName: blockerUser?.fullName ?? null,
          blockCount: row.blockCount,
          windowDays: ANTI_ABUSE.BLOCK_VOLUME_ALERT_WINDOW_DAYS,
          threshold: ANTI_ABUSE.BLOCK_VOLUME_ALERT_THRESHOLD,
        },
      })
      notificationsCreated += 1
    }
  }

  return { scanned: grouped.length, flagged: grouped.length, notificationsCreated }
}
