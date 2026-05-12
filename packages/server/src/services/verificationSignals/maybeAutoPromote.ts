import { Types } from 'mongoose'
import { ClaimRequestModel, ClaimTargetKind, IClaimRequest } from '../../entities/claimRequest/claimRequestModel'
import { VenueModel } from '../../entities/venue/venueModel'
import { ProductionCompanyModel } from '../../entities/productionCompany/productionCompanyModel'
import { PersonModel } from '../../entities/person/personModel'
import { UserModel } from '../../entities/user/userModel'
import { SIGNAL_POINTS } from '../../permissions/verificationSignals'
import { computeAutoPromotionScore, ScoreBreakdown } from './computeAutoPromotionScore'
import { writeAuditLog } from '../auditLog/writeAuditLog'
import { createNotification } from '../notifications/createNotification'

// Phase 8 — Auto-promotion helper.
//
// Computes score from current signals. If >= threshold and the claim is
// still pending, transitions the target unit to `claimed-passive`, marks
// the claim approved, writes a System-authored AuditLog row, and fires
// notifications to claimant + every admin.
//
// Returns { promoted, score } so callers can branch UI/cron behavior.

async function fetchUnit(kind: ClaimTargetKind, id: Types.ObjectId | string): Promise<any> {
  if (kind === 'venue') return VenueModel.findById(id)
  if (kind === 'productionCompany') return ProductionCompanyModel.findById(id)
  if (kind === 'person') return PersonModel.findById(id)
  return null
}

const TARGET_KIND_TO_AUDIT_KIND: Record<ClaimTargetKind, 'Venue' | 'ProductionCompany' | 'Person'> = {
  venue: 'Venue',
  productionCompany: 'ProductionCompany',
  person: 'Person',
}

export interface MaybeAutoPromoteResult {
  promoted: boolean
  score: number
  breakdown: ScoreBreakdown
}

export async function maybeAutoPromote(
  claimRequest: IClaimRequest & { _id?: any; save: () => Promise<any> }
): Promise<MaybeAutoPromoteResult> {
  const breakdown = await computeAutoPromotionScore(claimRequest)

  // Persist the latest score regardless (cheap; useful for admin surface).
  if (!claimRequest.signals) {
    ;(claimRequest as any).signals = {}
  }
  claimRequest.signals.autoPromotionScore = breakdown.total
  await claimRequest.save()

  if (claimRequest.status !== 'pending') {
    return { promoted: false, score: breakdown.total, breakdown }
  }
  if (breakdown.total < SIGNAL_POINTS.AUTO_PROMOTE_THRESHOLD) {
    return { promoted: false, score: breakdown.total, breakdown }
  }
  if (!claimRequest.target?.kind || !claimRequest.target?.id) {
    return { promoted: false, score: breakdown.total, breakdown }
  }

  const unit = await fetchUnit(claimRequest.target.kind, claimRequest.target.id)
  if (!unit) return { promoted: false, score: breakdown.total, breakdown }
  if (unit.claimState === 'claimed-passive' || unit.claimState === 'claimed-synced') {
    return { promoted: false, score: breakdown.total, breakdown }
  }

  // Transition unit → claimed-passive
  const oldDoc = unit.toObject ? unit.toObject() : { ...unit }
  unit.claimState = 'claimed-passive'
  unit.claimedBy = claimRequest.user
  unit.claimedAt = new Date()
  unit.lastClaimantActivityAt = new Date()
  await unit.save()

  // Person targets — backfill legacy bidirectional link to keep existing
  // `user` resolvers happy (mirrors approveClaim).
  if (claimRequest.target.kind === 'person') {
    const targetUser = await UserModel.findById(claimRequest.user)
    if (targetUser && !targetUser.personId) {
      targetUser.personId = unit._id
      await targetUser.save()
    }
    if (!unit.userId) {
      unit.userId = claimRequest.user
      await unit.save()
    }
  }

  claimRequest.status = 'approved'
  ;(claimRequest as any).reviewedAt = new Date()
  claimRequest.signals.autoPromotedAt = new Date()
  await claimRequest.save()

  // AuditLog attributed to System with a label describing which signals fired.
  await writeAuditLog({
    target: {
      kind: TARGET_KIND_TO_AUDIT_KIND[claimRequest.target.kind],
      id: unit._id,
    },
    author: {
      kind: 'System',
      label: `Auto-approved (signals: ${breakdown.details.join(', ') || 'n/a'})`,
    },
    oldDoc,
    newDoc: unit.toObject(),
    approvalSource: 'admin-override',
    approvalContext: {
      autoPromoted: true,
      score: breakdown.total,
      signals: breakdown.details,
      claimRequestId: (claimRequest as any)._id?.toString?.() ?? null,
    },
  })

  // Notify the claimant (FYI auto-approval).
  await createNotification({
    recipient: claimRequest.user,
    kind: 'claim_auto_approved',
    context: {
      targetKind: claimRequest.target.kind,
      targetId: unit._id.toString(),
      targetName: unit.name,
      targetSlug: unit.slug ?? null,
      score: breakdown.total,
      signals: breakdown.details,
    },
  })

  // Notify every admin (FYI; revocable from admin panel).
  const admins = await UserModel.find({ isAdmin: true }).select('_id').lean()
  for (const a of admins) {
    if (a._id.toString() === claimRequest.user.toString()) continue
    await createNotification({
      recipient: a._id,
      kind: 'claim_auto_approved',
      context: {
        targetKind: claimRequest.target.kind,
        targetId: unit._id.toString(),
        targetName: unit.name,
        targetSlug: unit.slug ?? null,
        claimantId: claimRequest.user.toString(),
        score: breakdown.total,
        signals: breakdown.details,
        forAdmin: true,
      },
    })
  }

  return { promoted: true, score: breakdown.total, breakdown }
}
