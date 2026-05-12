import { VenueModel } from '../../entities/venue/venueModel'
import { ProductionCompanyModel } from '../../entities/productionCompany/productionCompanyModel'
import { PersonModel } from '../../entities/person/personModel'
import { NotificationModel } from '../../entities/notification/notificationModel'
import { ClaimTransferModel } from '../../entities/claimTransfer/claimTransferModel'
import { createNotification } from '../notifications/createNotification'

// Phase 2 — claim auto-expire cron (Task 17).
//
//   Step 1: Find units inactive for >= 11 months. If we haven't sent a
//           pre_expire_warning for this unit in the past 30 days, send one.
//   Step 2: Find units inactive for >= 12 months AND a pre_expire_warning was
//           sent at least 30 days ago. Revert to unclaimed; fire claim_expired.
//   Step 3: Expire pending ClaimTransfer rows past their expiresAt.

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const ELEVEN_MONTHS_MS = 11 * 30 * ONE_DAY_MS
const TWELVE_MONTHS_MS = 12 * 30 * ONE_DAY_MS
const WARNING_REPEAT_GUARD_MS = 30 * ONE_DAY_MS

interface ProcessResult {
  warningsSent: number
  expired: number
  transfersExpired: number
}

async function processOneKind(
  kind: 'venue' | 'productionCompany' | 'person',
  Model: any,
  warningThreshold: Date,
  expireThreshold: Date,
  guardThreshold: Date,
): Promise<{ warningsSent: number; expired: number }> {
  let warningsSent = 0
  let expired = 0

  const staleUnits = await Model.find({
    claimState: { $in: ['claimed-passive', 'claimed-synced'] },
    claimedBy: { $ne: null },
    $or: [
      { lastClaimantActivityAt: { $lt: warningThreshold } },
      { lastClaimantActivityAt: null },
    ],
  })
    .select('_id name slug claimedBy claimState lastClaimantActivityAt claimedAt')
    .lean()

  for (const unit of staleUnits) {
    const effectiveActivity: Date | null = unit.lastClaimantActivityAt ?? unit.claimedAt ?? null
    if (!unit.claimedBy) continue

    const recentWarning = await NotificationModel.findOne({
      recipient: unit.claimedBy,
      kind: 'pre_expire_warning',
      'context.targetKind': kind,
      'context.targetId': unit._id.toString(),
    })
      .sort({ createdAt: -1 })
      .select('createdAt')
      .lean()

    const warnedRecently = recentWarning && recentWarning.createdAt >= guardThreshold

    // Step 2: 12-month expire (requires a prior warning that's > 30 days old)
    if (effectiveActivity && effectiveActivity < expireThreshold && recentWarning && !warnedRecently) {
      await Model.updateOne(
        { _id: unit._id, claimedBy: unit.claimedBy },
        {
          $set: {
            claimState: 'unclaimed',
            claimedBy: null,
            claimedAt: null,
            syncHealth: null,
            syncSourceConnectedAt: null,
            lastClaimantActivityAt: null,
          }
        }
      )
      await createNotification({
        recipient: unit.claimedBy,
        kind: 'claim_expired',
        context: {
          targetKind: kind,
          targetId: unit._id.toString(),
          targetName: unit.name,
          targetSlug: unit.slug ?? null,
        }
      })
      expired++
      continue
    }

    // Step 1: 11-month warning
    if (effectiveActivity && effectiveActivity < warningThreshold && !warnedRecently) {
      await createNotification({
        recipient: unit.claimedBy,
        kind: 'pre_expire_warning',
        context: {
          targetKind: kind,
          targetId: unit._id.toString(),
          targetName: unit.name,
          targetSlug: unit.slug ?? null,
        }
      })
      warningsSent++
    }
  }

  return { warningsSent, expired }
}

export async function processClaimExpire(): Promise<ProcessResult> {
  const now = Date.now()
  const warningThreshold = new Date(now - ELEVEN_MONTHS_MS)
  const expireThreshold = new Date(now - TWELVE_MONTHS_MS)
  const guardThreshold = new Date(now - WARNING_REPEAT_GUARD_MS)

  const [venueResult, companyResult, personResult] = await Promise.all([
    processOneKind('venue', VenueModel, warningThreshold, expireThreshold, guardThreshold),
    processOneKind('productionCompany', ProductionCompanyModel, warningThreshold, expireThreshold, guardThreshold),
    processOneKind('person', PersonModel, warningThreshold, expireThreshold, guardThreshold),
  ])

  // Step 3: expire pending transfers past expiresAt
  const expiredTransferResult = await ClaimTransferModel.updateMany(
    { status: 'pending', expiresAt: { $lt: new Date() } },
    { $set: { status: 'expired', respondedAt: new Date() } }
  )

  return {
    warningsSent: venueResult.warningsSent + companyResult.warningsSent + personResult.warningsSent,
    expired: venueResult.expired + companyResult.expired + personResult.expired,
    transfersExpired: expiredTransferResult.modifiedCount,
  }
}
