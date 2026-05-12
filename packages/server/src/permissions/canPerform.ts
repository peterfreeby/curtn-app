import { Types } from 'mongoose'
import { ActionId, ACTION_CATALOG, ActionTargetKind } from './actionCatalog'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import { ProductionCompanyModel } from '../entities/productionCompany/productionCompanyModel'
import { PersonModel } from '../entities/person/personModel'
import { PerformanceModel } from '../entities/performance/performanceModel'
import { RunModel } from '../entities/run/runModel'

// Central permission gate for every edit on a claimable unit.
//
// Phase 1: admin and claimant auto-publish; everything else denied.
// Phase 4 (live): non-claimant on a claimed record routes to the proposal
//                 queue via `mode: 'queue'`. Performance routes to a joint-
//                 stewardship queue when both venue + company claimants exist.
// Future phases:
//   - Phase 5: trusted editor + 1-hop cascade checks
//   - Phase 7: anti-abuse layers (rate limits, autoconfirmed gate, blocks)

export type UnitKind = ActionTargetKind  // 'Venue' | 'ProductionCompany' | 'Person' | 'Performance'

export interface UnitRef {
  kind: UnitKind
  id: string | Types.ObjectId
}

export type CanPerformMode = 'auto-publish' | 'queue' | 'denied'

export interface CanPerformDecision {
  allowed: boolean
  mode: CanPerformMode
  reason?: string
  // Phase 4 — populated when mode is 'queue' on Performance with two distinct claimants.
  isJointStewardship?: boolean
  jointClaimants?: {
    venueClaimantId?: string
    companyClaimantId?: string
  }
}

export async function canPerform(
  userId: string | null | undefined,
  actionId: ActionId,
  unitRef: UnitRef
): Promise<CanPerformDecision> {
  if (!userId) return denied('Unauthenticated')

  const action = ACTION_CATALOG[actionId]
  if (!action) return denied(`Unknown action: ${actionId}`)
  if (action.targetType !== unitRef.kind) {
    return denied(`Action ${actionId} cannot be performed on ${unitRef.kind}`)
  }

  const user = await UserModel.findById(userId).select('isAdmin').lean()
  if (user?.isAdmin) return autoPublish()

  // Performance: resolves to the venue claimant + run's productionCompany claimant.
  if (unitRef.kind === 'Performance') {
    return await canPerformOnPerformance(userId, unitRef.id)
  }

  // Venue / ProductionCompany / Person.
  const claimedBy = await fetchClaimedBy(unitRef.kind, unitRef.id)

  // Unclaimed unit: only admins direct-publish in Phase 1. Phase 4 still routes
  // non-admin edits on unclaimed records to denied until the "anyone can edit
  // unclaimed records" mechanic ships in a later phase.
  if (!claimedBy) return denied('Only admin can edit unclaimed records (Phase 1 scope)')

  if (claimedBy.toString() === userId) return autoPublish()

  // Non-claimant on a claimed record → queue (Phase 4).
  return queue()
}

async function canPerformOnPerformance(
  userId: string,
  performanceId: string | Types.ObjectId
): Promise<CanPerformDecision> {
  const performance = await PerformanceModel.findById(performanceId).select('run venueId').lean()
  if (!performance) return denied('Performance not found')

  const run = await RunModel.findById(performance.run).select('productionCompany').lean()
  if (!run) return denied('Run not found')

  const [venue, company] = await Promise.all([
    VenueModel.findById(performance.venueId).select('claimedBy').lean(),
    run.productionCompany
      ? ProductionCompanyModel.findById(run.productionCompany).select('claimedBy').lean()
      : Promise.resolve(null),
  ])

  const venueClaimantId = venue?.claimedBy?.toString() ?? undefined
  const companyClaimantId = company?.claimedBy?.toString() ?? undefined

  const isVenueClaimant = !!venueClaimantId && venueClaimantId === userId
  const isCompanyClaimant = !!companyClaimantId && companyClaimantId === userId

  // Neither side claimed → denied (matches Phase 1 unclaimed-record behavior).
  if (!venueClaimantId && !companyClaimantId) {
    return denied('Only admin can edit unclaimed records (Phase 1 scope)')
  }

  // Phase 4: if the editor is one of the claimants, auto-publish (still
  // unanimous because the other side gets notified via proposal? — no:
  // claimants editing their own units bypass the queue per scoping doc.
  // Joint-mode only triggers when a non-claimant submits an edit).
  if (isVenueClaimant || isCompanyClaimant) return autoPublish()

  // Non-claimant editing a Performance: queue. Mark joint if both sides have
  // claimants; single-side joint still uses queue mode (the lone claimant
  // approves alone).
  const isJoint = !!venueClaimantId && !!companyClaimantId
  return queue({
    isJointStewardship: isJoint,
    jointClaimants: {
      venueClaimantId,
      companyClaimantId,
    },
  })
}

async function fetchClaimedBy(
  kind: UnitKind,
  id: string | Types.ObjectId
): Promise<Types.ObjectId | null | undefined> {
  if (kind === 'Venue') {
    const v = await VenueModel.findById(id).select('claimedBy').lean()
    return v?.claimedBy
  }
  if (kind === 'ProductionCompany') {
    const c = await ProductionCompanyModel.findById(id).select('claimedBy').lean()
    return c?.claimedBy
  }
  if (kind === 'Person') {
    const p = await PersonModel.findById(id).select('claimedBy').lean()
    return p?.claimedBy
  }
  return null
}

function autoPublish(): CanPerformDecision {
  return { allowed: true, mode: 'auto-publish' }
}

function queue(extra: Pick<CanPerformDecision, 'isJointStewardship' | 'jointClaimants'> = {}): CanPerformDecision {
  return { allowed: true, mode: 'queue', ...extra }
}

function denied(reason: string): CanPerformDecision {
  return { allowed: false, mode: 'denied', reason }
}
