import { GraphQLBoolean, GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { Types } from 'mongoose'
import { errorField } from '../../../graphql/errorField'
import { ProposalModel, ProposalTargetKind } from '../proposalModel'
import { proposalType } from '../proposalTypes'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../person/personModel'
import { ShowModel } from '../../show/showModel'
import { RunModel } from '../../run/runModel'
import { PerformanceModel } from '../../performance/performanceModel'
import { StageModel } from '../../stage/stageModel'
import { UserModel } from '../../user/userModel'
import { writeAuditLog } from '../../../services/auditLog/writeAuditLog'
import { createNotification } from '../../../services/notifications/createNotification'
import { bumpForUnit } from '../../../services/claims/bumpClaimantActivity'
import { PendingImportModel } from '../../pendingImport/pendingImportModel'

// Phase 4 — approveProposal. Single-approver case applies the diff and writes
// an AuditLog row attributed to the original proposer. Joint case requires
// two approvals (one from each side) before applying; first approval just
// records the vote and bumps firstApprovalAt for the timeout clock.

export type ApprovalSourceForProposal = 'claimant-approved' | 'timeout-approved'

function modelForKind(kind: ProposalTargetKind): any {
  switch (kind) {
    case 'Venue': return VenueModel
    case 'ProductionCompany': return ProductionCompanyModel
    case 'Person': return PersonModel
    case 'Show': return ShowModel
    case 'Run': return RunModel
    case 'Performance': return PerformanceModel
    case 'Stage': return StageModel
    default: return null
  }
}

function bumpKindForTarget(kind: ProposalTargetKind): 'venue' | 'productionCompany' | 'person' | null {
  switch (kind) {
    case 'Venue': return 'venue'
    case 'ProductionCompany': return 'productionCompany'
    case 'Person': return 'person'
    default: return null
  }
}

// Resolves the joint role of an approver — venue claimant vs company claimant
// for a Performance proposal. Returns null if the user is neither.
async function resolveJointRole(
  performanceId: Types.ObjectId,
  userId: string,
): Promise<'venue-claimant' | 'company-claimant' | null> {
  const perf = await PerformanceModel.findById(performanceId).select('run venueId').lean()
  if (!perf) return null
  const run = await RunModel.findById(perf.run).select('productionCompany').lean()
  const [v, c] = await Promise.all([
    VenueModel.findById(perf.venueId).select('claimedBy').lean(),
    run?.productionCompany
      ? ProductionCompanyModel.findById(run.productionCompany).select('claimedBy').lean()
      : Promise.resolve(null),
  ])
  if (v?.claimedBy?.toString() === userId) return 'venue-claimant'
  if (c?.claimedBy?.toString() === userId) return 'company-claimant'
  return null
}

async function isApproverEligibleSingle(
  kind: ProposalTargetKind,
  targetId: Types.ObjectId,
  userId: string,
): Promise<boolean> {
  // For single-approver flows, the approver must be the unit's claimant or an admin.
  const adminUser = await UserModel.findById(userId).select('isAdmin').lean()
  if (adminUser?.isAdmin) return true
  const Model = modelForKind(kind)
  if (!Model) return false
  if (kind === 'Show' || kind === 'Run' || kind === 'Stage') {
    return false
  }
  const doc: any = await Model.findById(targetId).select('claimedBy').lean()
  return doc?.claimedBy?.toString() === userId
}

// Applies the diff and writes the audit row. Shared by manual approval +
// timeout cron. `approvalSource` distinguishes the two.
export async function applyProposalDiff(
  proposal: any,
  approvalSource: ApprovalSourceForProposal,
  approvalContext?: Record<string, any>,
): Promise<{ ok: boolean; error?: string }> {
  const diff = proposal.diff || {}

  // Phase 4 scraper bridge: proposals wrapping a PendingImport (diff has the
  // `_pendingImport` marker). Approval promotes the PI to real records.
  if (diff._pendingImport && proposal.pendingImportId) {
    return await applyPendingImportProposal(proposal, approvalSource, approvalContext)
  }

  const Model = modelForKind(proposal.target.kind)
  if (!Model) return { ok: false, error: `Unsupported target kind: ${proposal.target.kind}` }
  const target = await Model.findById(proposal.target.id)
  if (!target) return { ok: false, error: 'Target record not found' }

  const updates: Record<string, any> = {}
  for (const key of Object.keys(diff)) {
    if (key === '_created' || key === 'snapshot' || key === '_hidden') continue
    const entry = diff[key]
    if (entry && typeof entry === 'object' && 'new' in entry) {
      updates[key] = entry.new
    }
  }
  if (Object.keys(updates).length === 0) {
    return { ok: false, error: 'Proposal diff is empty' }
  }

  const oldDoc = target.toObject()
  const updated = await Model.findByIdAndUpdate(proposal.target.id, updates, { new: true })
  if (!updated) return { ok: false, error: 'Target update returned null' }

  // Map Proposal proposer.kind → AuditLog author.kind. The two enums share
  // 'User' and 'Scraper'; Phase 6 adds 'SyncFeed' to both.
  const auditAuthorKind: 'User' | 'Scraper' | 'SyncFeed' =
    proposal.proposer.kind === 'Scraper' ? 'Scraper'
      : proposal.proposer.kind === 'SyncFeed' ? 'SyncFeed'
      : 'User'

  await writeAuditLog({
    target: { kind: proposal.target.kind, id: updated._id },
    author: {
      kind: auditAuthorKind,
      userId: proposal.proposer.userId ?? null,
      dataSourceId: proposal.proposer.dataSourceId ?? null,
      label: proposal.proposer.label,
    },
    oldDoc,
    newDoc: updated.toObject(),
    approvalSource,
    approvalContext: {
      proposalId: proposal._id.toString(),
      ...(approvalContext ?? {}),
    },
  })

  // Bump claimant activity if appropriate (the proposal-approval action
  // counts as activity for the claimant who approved it). Caller can pass
  // approverUserId in approvalContext if desired; we rely on the claim
  // bumping for the target rather than the approver's user, since
  // approveProposal is the activity here.
  const bumpKind = bumpKindForTarget(proposal.target.kind)
  if (bumpKind) {
    await bumpForUnit(bumpKind, updated._id)
  }

  return { ok: true }
}

// Phase 4 scraper bridge approval — runs promoteToRecords on the underlying
// PendingImport and marks it approved. No AuditLog row is written here
// because the records are being created, not edited; the new records' own
// _created snapshot is handled by writeAuditLog calls inside the creation
// path if/when that's wired separately (Phase 4 doesn't backfill AuditLog
// for newly-promoted PendingImports — that's deferred).
async function applyPendingImportProposal(
  proposal: any,
  approvalSource: ApprovalSourceForProposal,
  approvalContext?: Record<string, any>,
): Promise<{ ok: boolean; error?: string }> {
  const { promoteToRecords } = require('../../pendingImport/mutations/reviewPendingImport') as {
    promoteToRecords: (pi: any, userId: string) => Promise<void>
  }
  const pi = await PendingImportModel.findById(proposal.pendingImportId)
  if (!pi) return { ok: false, error: 'Linked PendingImport not found' }
  if (pi.status !== 'pending') return { ok: false, error: `PendingImport already ${pi.status}` }
  // Use the proposer's userId if it's a User-driven proposal; otherwise fall
  // back to the proposal's approver. For Scraper proposals, prefer the
  // claimant-approver as the submittedBy for promoted records.
  const effectiveUserId = (approvalContext?.approverId as string)
    ?? (proposal.approvedBy?.toString?.() ?? null)
    ?? null
  if (!effectiveUserId) return { ok: false, error: 'No effective submitter for PendingImport promotion' }
  try {
    await promoteToRecords(pi, effectiveUserId)
    pi.status = 'approved'
    pi.reviewedAt = new Date()
    pi.reviewedBy = effectiveUserId as any
    pi.error = undefined
    await pi.save()
    return { ok: true }
  } catch (err: any) {
    pi.error = err.message
    await pi.save()
    return { ok: false, error: `Promotion failed: ${err.message}` }
  }
}

// Auto-declines all other pending proposals that conflicted with the one
// being approved. Per scoping doc D4.
async function autoDeclineConflicts(proposal: any) {
  if (!proposal.conflictsWithProposalIds?.length) return
  await ProposalModel.updateMany(
    {
      _id: { $in: proposal.conflictsWithProposalIds },
      status: 'pending',
    },
    {
      $set: {
        status: 'auto-declined-conflict',
        declinedAt: new Date(),
        declineReason: `Conflicting proposal ${proposal._id.toString()} was approved`,
      },
    },
  )
  // Notify other proposers
  const others = await ProposalModel.find({
    _id: { $in: proposal.conflictsWithProposalIds },
    status: 'auto-declined-conflict',
  }).select('proposer target').lean()
  for (const o of others) {
    if (o.proposer?.kind === 'User' && o.proposer.userId) {
      await createNotification({
        recipient: o.proposer.userId,
        kind: 'proposal_declined',
        context: {
          proposalId: o._id.toString(),
          targetKind: o.target.kind,
          targetId: o.target.id.toString(),
          declineReason: 'A conflicting proposal was approved first',
        },
      })
    }
  }
}

export const approveProposal = mutationWithClientMutationId({
  name: 'approveProposal',
  description: 'Approve a proposal. Applies the diff for single-approver flows; records a vote for joint stewardship until both sides approve.',
  inputFields: {
    proposalId: { type: new GraphQLNonNull(GraphQLString) },
    autoApproveFutureFromProposer: {
      type: GraphQLBoolean,
      description: 'Phase 4 stub: log the approver\'s intent to auto-approve future edits from this proposer. Phase 5 will read this signal to create TrustedEditor records.'
    },
  },
  outputFields: {
    proposal: { type: proposalType, resolve: (r: any) => r.proposal },
    applied: { type: GraphQLBoolean, resolve: (r: any) => !!r.applied },
    ...errorField,
  },
  mutateAndGetPayload: async ({ proposalId, autoApproveFutureFromProposer }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    const proposal = await ProposalModel.findById(proposalId)
    if (!proposal) return { error: 'Proposal not found' }
    if (proposal.status !== 'pending') return { error: `Proposal already ${proposal.status}` }

    // Phase 4 trusted-editor stub: log the user's intent. Phase 5 will read this.
    if (autoApproveFutureFromProposer) {
      // eslint-disable-next-line no-console
      console.log('[Phase4 stub] auto-approve-future intent', {
        approverId: ctx.user.id,
        proposerKind: proposal.proposer.kind,
        proposerUserId: proposal.proposer.userId?.toString() ?? null,
        proposerDataSourceId: proposal.proposer.dataSourceId?.toString() ?? null,
        proposalId: proposal._id.toString(),
        timestamp: new Date().toISOString(),
      })
    }

    const isJoint = !!proposal.isJointStewardship
    const targetId = proposal.target.id as Types.ObjectId

    if (!isJoint) {
      const eligible = await isApproverEligibleSingle(
        proposal.target.kind as ProposalTargetKind,
        targetId,
        ctx.user.id,
      )
      if (!eligible) return { error: 'You are not authorized to approve this proposal' }

      const applyResult = await applyProposalDiff(proposal, 'claimant-approved', { approverId: ctx.user.id })
      if (!applyResult.ok) return { error: applyResult.error }

      proposal.status = 'approved'
      proposal.approvedBy = ctx.user.id
      proposal.approvedAt = new Date()
      await proposal.save()

      await autoDeclineConflicts(proposal)

      if (proposal.proposer?.kind === 'User' && proposal.proposer.userId) {
        await createNotification({
          recipient: proposal.proposer.userId,
          kind: 'proposal_approved',
          context: {
            proposalId: proposal._id.toString(),
            targetKind: proposal.target.kind,
            targetId: targetId.toString(),
          },
        })
      }

      return { proposal, applied: true }
    }

    // Joint stewardship path — Performance proposals.
    const role = await resolveJointRole(targetId, ctx.user.id)
    const adminUser = await UserModel.findById(ctx.user.id).select('isAdmin').lean()
    if (!role && !adminUser?.isAdmin) {
      return { error: 'You are not a claimant on this performance' }
    }

    // Admin approval: shortcuts to apply. Track which role they exercised
    // only if they actually qualify as a claimant; otherwise treat as override.
    if (adminUser?.isAdmin && !role) {
      const applyResult = await applyProposalDiff(proposal, 'claimant-approved', { adminOverride: true, approverId: ctx.user.id })
      if (!applyResult.ok) return { error: applyResult.error }
      proposal.status = 'approved'
      proposal.approvedBy = ctx.user.id
      proposal.approvedAt = new Date()
      await proposal.save()
      await autoDeclineConflicts(proposal)
      if (proposal.proposer?.kind === 'User' && proposal.proposer.userId) {
        await createNotification({
          recipient: proposal.proposer.userId,
          kind: 'proposal_approved',
          context: {
            proposalId: proposal._id.toString(),
            targetKind: proposal.target.kind,
            targetId: targetId.toString(),
          },
        })
      }
      return { proposal, applied: true }
    }

    // Already approved by this role?
    const existing = proposal.approvals.find(a => a.role === role)
    if (existing) {
      return { error: `Already approved by this role (${role})` }
    }

    proposal.approvals.push({
      userId: new Types.ObjectId(ctx.user.id),
      role: role!,
      approvedAt: new Date(),
    })
    if (!proposal.firstApprovalAt) {
      proposal.firstApprovalAt = new Date()
    }

    // Determine if both roles are accounted for.
    const hasVenue = proposal.approvals.some(a => a.role === 'venue-claimant')
    const hasCompany = proposal.approvals.some(a => a.role === 'company-claimant')

    // Resolve whether the proposal actually requires both — if one side is
    // unclaimed, the single approval is enough.
    const perf = await PerformanceModel.findById(targetId).select('run venueId').lean()
    const run = perf ? await RunModel.findById(perf.run).select('productionCompany').lean() : null
    const [venueDoc, companyDoc] = await Promise.all([
      perf ? VenueModel.findById(perf.venueId).select('claimedBy').lean() : null,
      run?.productionCompany ? ProductionCompanyModel.findById(run.productionCompany).select('claimedBy').lean() : null,
    ])
    const venueNeeded = !!venueDoc?.claimedBy
    const companyNeeded = !!companyDoc?.claimedBy

    const venueSatisfied = !venueNeeded || hasVenue
    const companySatisfied = !companyNeeded || hasCompany

    if (venueSatisfied && companySatisfied) {
      const applyResult = await applyProposalDiff(proposal, 'claimant-approved', { approverId: ctx.user.id })
      if (!applyResult.ok) return { error: applyResult.error }
      proposal.status = 'approved'
      proposal.approvedBy = ctx.user.id
      proposal.approvedAt = new Date()
      await proposal.save()
      await autoDeclineConflicts(proposal)
      if (proposal.proposer?.kind === 'User' && proposal.proposer.userId) {
        await createNotification({
          recipient: proposal.proposer.userId,
          kind: 'proposal_approved',
          context: {
            proposalId: proposal._id.toString(),
            targetKind: proposal.target.kind,
            targetId: targetId.toString(),
          },
        })
      }
      return { proposal, applied: true }
    }

    // Partial approval — save and wait for the other side or timeout.
    await proposal.save()
    return { proposal, applied: false }
  }
})
