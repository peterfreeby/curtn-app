import { Types } from 'mongoose'
import { ANTI_ABUSE, ONE_DAY_MS } from './antiAbuseConfig'
import { UserModel } from '../entities/user/userModel'
import { BlockModel } from '../entities/block/blockModel'
import { ProposalModel } from '../entities/proposal/proposalModel'
import { AuditLogModel } from '../entities/auditLog/auditLogModel'
import { VenueModel } from '../entities/venue/venueModel'
import { ProductionCompanyModel } from '../entities/productionCompany/productionCompanyModel'
import { PersonModel } from '../entities/person/personModel'
import { ActionTargetKind } from './actionCatalog'

// Phase 7 — anti-abuse pre-checks. Consulted from canPerform BEFORE any
// permission grant logic; the order matters because we want a blocked user's
// edit silently rejected even if they would otherwise be admin/claimant.
//
// (Claimant editing their own unit is exempt — see canPerform; we don't
// re-check claimant status here, the caller does.)

export type AntiAbuseReason = 'blocked' | 'rate_limited_record' | 'rate_limited_global'

export interface AntiAbuseTargetRef {
  kind: ActionTargetKind
  id: string | Types.ObjectId
}

export interface AntiAbuseResult {
  allowed: boolean
  reason?: AntiAbuseReason
}

const ALLOWED: AntiAbuseResult = { allowed: true }

// Block check is scoped to Venue/ProductionCompany/Person. Performance edits
// share the venue and the run's productionCompany; we check both.
async function isBlockedOnTarget(
  userId: Types.ObjectId,
  target: AntiAbuseTargetRef,
): Promise<boolean> {
  if (target.kind === 'Performance') {
    // Resolve underlying venue + company and check both. Lazy-load to avoid
    // a circular dep with the performance/run models in checkAntiAbuse.
    const { PerformanceModel } = require('../entities/performance/performanceModel') as { PerformanceModel: any }
    const { RunModel } = require('../entities/run/runModel') as { RunModel: any }
    const perf = await PerformanceModel.findById(target.id).select('run venueId').lean()
    if (!perf) return false
    const run = perf.run ? await RunModel.findById(perf.run).select('productionCompany').lean() : null
    const ids: Types.ObjectId[] = []
    if (perf.venueId) ids.push(perf.venueId)
    if (run?.productionCompany) ids.push(run.productionCompany)
    if (ids.length === 0) return false
    const blockedRow = await BlockModel.findOne({
      blockedUser: userId,
      'scopedTo.id': { $in: ids },
      revokedAt: null,
    }).select('_id').lean()
    return !!blockedRow
  }
  const blockedRow = await BlockModel.findOne({
    blockedUser: userId,
    'scopedTo.kind': target.kind,
    'scopedTo.id': target.id,
    revokedAt: null,
  }).select('_id').lean()
  return !!blockedRow
}

// Total edit attempts (Proposal AND AuditLog rows) authored by `userId` in
// the trailing 24h, optionally filtered to a single target. Same shape used
// by per-record and global checks; pass `null` for `target` to skip the
// target filter.
async function countRecentEdits(
  userId: Types.ObjectId,
  target: AntiAbuseTargetRef | null,
): Promise<number> {
  const since = new Date(Date.now() - ONE_DAY_MS)

  const proposalFilter: Record<string, any> = {
    'proposer.userId': userId,
    'proposer.kind': 'User',
    createdAt: { $gte: since },
  }
  const auditFilter: Record<string, any> = {
    'author.userId': userId,
    'author.kind': 'User',
    createdAt: { $gte: since },
  }
  if (target) {
    proposalFilter['target.kind'] = target.kind
    proposalFilter['target.id'] = target.id
    auditFilter['target.kind'] = target.kind
    auditFilter['target.id'] = target.id
  }

  const [proposals, audits] = await Promise.all([
    ProposalModel.countDocuments(proposalFilter),
    AuditLogModel.countDocuments(auditFilter),
  ])
  return proposals + audits
}

// Quick claimant check used to bypass anti-abuse for self-edits. Mirrors the
// fetchClaimedBy in canPerform but tolerates the Performance kind by treating
// it as never-self-claimed (canPerform routes those through its joint path).
async function isClaimantOf(
  userId: Types.ObjectId,
  target: AntiAbuseTargetRef,
): Promise<boolean> {
  if (target.kind === 'Performance') return false
  const Model = target.kind === 'Venue' ? VenueModel
    : target.kind === 'ProductionCompany' ? ProductionCompanyModel
    : PersonModel
  const doc: any = await (Model as any).findById(target.id).select('claimedBy').lean()
  return doc?.claimedBy?.toString() === userId.toString()
}

export async function checkAntiAbuse(
  userId: string,
  target: AntiAbuseTargetRef,
): Promise<AntiAbuseResult> {
  const uid = new Types.ObjectId(userId)

  // Admin and the unit's own claimant skip ALL anti-abuse layers. Admin check
  // pulled first to spare the DB roundtrip on common-case admin edits.
  const user = await UserModel.findById(uid).select('isAdmin').lean()
  if (user?.isAdmin) return ALLOWED
  if (await isClaimantOf(uid, target)) return ALLOWED

  // Layer 4 first (cheapest deny — most users aren't blocked anywhere).
  if (await isBlockedOnTarget(uid, target)) {
    return { allowed: false, reason: 'blocked' }
  }

  // Layer 1: per-record rate limit. PER_RECORD_LIMIT is the inclusive
  // ceiling; the (LIMIT+1)th attempt is rejected.
  const perRecord = await countRecentEdits(uid, target)
  if (perRecord >= ANTI_ABUSE.PER_RECORD_LIMIT) {
    return { allowed: false, reason: 'rate_limited_record' }
  }

  // Layer 2: global velocity.
  const global = await countRecentEdits(uid, null)
  if (global >= ANTI_ABUSE.GLOBAL_VELOCITY_LIMIT) {
    return { allowed: false, reason: 'rate_limited_global' }
  }

  return ALLOWED
}

// Layer 3 gate. A user is autoconfirmed once they've made >= AUTOCONFIRMED_EDITS
// AND their account is >= AUTOCONFIRMED_DAYS old. Computed live off the User
// row — `editCount` is denormalized but kept in sync via incrementEditActivity.
// Stored `autoconfirmedAchievedAt` lets us fire `autoconfirmed_achieved` once.
export async function isAutoconfirmed(userId: string | Types.ObjectId): Promise<boolean> {
  const user = await UserModel.findById(userId).select('createdAt editCount').lean()
  if (!user) return false
  if ((user.editCount ?? 0) < ANTI_ABUSE.AUTOCONFIRMED_EDITS) return false
  const created = user.createdAt instanceof Date ? user.createdAt.getTime() : new Date(user.createdAt as any).getTime()
  if (!Number.isFinite(created)) return false
  const ageMs = Date.now() - created
  return ageMs >= ANTI_ABUSE.AUTOCONFIRMED_DAYS * ONE_DAY_MS
}
