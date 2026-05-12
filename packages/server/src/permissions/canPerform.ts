import { Types } from 'mongoose'
import { ActionId, ACTION_CATALOG, ActionTargetKind } from './actionCatalog'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import { ProductionCompanyModel } from '../entities/productionCompany/productionCompanyModel'
import { PersonModel } from '../entities/person/personModel'
import { PerformanceModel } from '../entities/performance/performanceModel'
import { RunModel } from '../entities/run/runModel'
import { TrustedEditorModel } from '../entities/trustedEditor/trustedEditorModel'
import { checkAntiAbuse, isAutoconfirmed } from './checkAntiAbuse'

// Central permission gate for every edit on a claimable unit.
//
// Phase 1: admin and claimant auto-publish; everything else denied.
// Phase 4: non-claimant on a claimed record routes to the proposal queue
//          via `mode: 'queue'`. Performance routes to a joint-stewardship
//          queue when both venue + company claimants exist.
// Phase 5 (live): trusted-editor direct grants + 1-hop unit→unit cascade
//                 (Manager-scope only). Consulted BEFORE the queue fallback so
//                 in-scope grants auto-publish.
// Future phases:
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
  // Phase 5 — set when auto-publish was unlocked by a trusted-editor grant
  // (direct or cascade). Used by callers to attribute the audit row.
  trustSource?: 'direct-grant' | 'cascade'
  // Phase 7 — set on queue routing for the community-review path (non-
  // autoconfirmed user editing an unclaimed record). The createProposal
  // call uses this to flag the Proposal for /community-review.
  isCommunityReview?: boolean
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

  // Phase 7 — anti-abuse pre-check. Runs BEFORE admin/claimant grants so that
  // a blocked or rate-limited user is rejected even on a unit they could
  // otherwise edit. The helper internally exempts admins + the unit's own
  // claimant from all four layers (per scoping doc D6 open question — a
  // claimant editing their own unit should never trip).
  const abuse = await checkAntiAbuse(userId, { kind: unitRef.kind, id: unitRef.id })
  if (!abuse.allowed) return denied(abuse.reason!)

  const user = await UserModel.findById(userId).select('isAdmin').lean()
  if (user?.isAdmin) return autoPublish()

  // Performance: resolves to the venue claimant + run's productionCompany claimant.
  if (unitRef.kind === 'Performance') {
    return await canPerformOnPerformance(userId, unitRef.id)
  }

  // Venue / ProductionCompany / Person.
  const claimedBy = await fetchClaimedBy(unitRef.kind, unitRef.id)

  if (claimedBy && claimedBy.toString() === userId) return autoPublish()

  // Phase 5 — trusted editor lookups (only meaningful on claimed records,
  // since grants are made by a claimant). Consulted on claimed records before
  // the queue fallback.
  if (claimedBy) {
    const trustDecision = await consultTrustedEditors(userId, actionId, unitRef)
    if (trustDecision) return trustDecision
    // Non-claimant on a claimed record → queue (Phase 4).
    return queue()
  }

  // Phase 7 — unclaimed record. Autoconfirmed users auto-publish per the
  // original "anyone can edit unclaimed records" design; brand-new accounts
  // route to /community-review until they hit 4 days + 10 edits.
  const auto = await isAutoconfirmed(userId)
  if (auto) return autoPublish()
  return queue({ isCommunityReview: true })
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

  // Phase 7 — both sides unclaimed: autoconfirmed users auto-publish; non-
  // autoconfirmed route to community review.
  if (!venueClaimantId && !companyClaimantId) {
    const auto = await isAutoconfirmed(userId)
    if (auto) return autoPublish()
    return queue({ isCommunityReview: true })
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

// Phase 5 — TrustedEditor consultation. Returns an auto-publish decision when
// the user is in scope (direct or via 1-hop cascade); returns null to let the
// caller fall through to queue/denied.
async function consultTrustedEditors(
  userId: string,
  actionId: ActionId,
  unitRef: UnitRef,
): Promise<CanPerformDecision | null> {
  // (a) Direct user grant on this exact unit.
  const direct = await TrustedEditorModel.findOne({
    'grantedOn.kind': unitRef.kind,
    'grantedOn.id': unitRef.id,
    'recipient.kind': 'User',
    'recipient.id': new Types.ObjectId(userId),
    revokedAt: null,
    scope: actionId,
  }).select('_id').lean()
  if (direct) return { ...autoPublish(), trustSource: 'direct-grant' }

  // (b) 1-hop unit cascade. Find unit-kind grants on this unit whose scope
  // includes the action; for each, check whether the user is that recipient
  // unit's claimant or a Manager-scope editor of it. Cascade STOPS here —
  // never recurse another hop.
  const unitGrants = await TrustedEditorModel.find({
    'grantedOn.kind': unitRef.kind,
    'grantedOn.id': unitRef.id,
    'recipient.kind': { $in: ['Venue', 'ProductionCompany', 'Person'] },
    revokedAt: null,
    scope: actionId,
  }).select('recipient').lean()

  if (unitGrants.length === 0) return null

  for (const grant of unitGrants) {
    const recipientKind = grant.recipient.kind as 'Venue' | 'ProductionCompany' | 'Person'
    const recipientId = grant.recipient.id
    // Is user the claimant of the recipient unit?
    const recipientClaimant = await fetchClaimedBy(recipientKind, recipientId)
    if (recipientClaimant && recipientClaimant.toString() === userId) {
      return { ...autoPublish(), trustSource: 'cascade' }
    }
    // Is user a Manager-scope editor of the recipient unit?
    const managerGrant = await TrustedEditorModel.findOne({
      'grantedOn.kind': recipientKind,
      'grantedOn.id': recipientId,
      'recipient.kind': 'User',
      'recipient.id': new Types.ObjectId(userId),
      roleTemplate: 'Manager',
      revokedAt: null,
    }).select('_id').lean()
    if (managerGrant) {
      return { ...autoPublish(), trustSource: 'cascade' }
    }
  }

  return null
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

function queue(extra: Pick<CanPerformDecision, 'isJointStewardship' | 'jointClaimants' | 'isCommunityReview'> = {}): CanPerformDecision {
  return { allowed: true, mode: 'queue', ...extra }
}

function denied(reason: string): CanPerformDecision {
  return { allowed: false, mode: 'denied', reason }
}
