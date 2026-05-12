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
// Phase 1 scope: admin and claimant auto-publish; everything else denied.
// Future phases extend this function (without changing the signature):
//   - Phase 4: returns mode: 'queue' for proposals instead of denying
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

  // Performance: joint stewardship resolves to the venue claimant + run's productionCompany claimant.
  // Phase 1 lets either claimant auto-publish. Phase 4 introduces unanimous-with-timeout.
  if (unitRef.kind === 'Performance') {
    return await canPerformOnPerformance(userId, unitRef.id)
  }

  // Venue / ProductionCompany / Person: claimant auto-publishes.
  const claimedBy = await fetchClaimedBy(unitRef.kind, unitRef.id)
  if (claimedBy && claimedBy.toString() === userId) return autoPublish()

  return denied('Queueing not yet supported (Phase 4)')
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
    ProductionCompanyModel.findById(run.productionCompany).select('claimedBy').lean(),
  ])

  const isVenueClaimant = venue?.claimedBy?.toString() === userId
  const isCompanyClaimant = company?.claimedBy?.toString() === userId

  if (isVenueClaimant || isCompanyClaimant) return autoPublish()
  return denied('Queueing not yet supported (Phase 4)')
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

function denied(reason: string): CanPerformDecision {
  return { allowed: false, mode: 'denied', reason }
}
