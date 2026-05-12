import { Types } from 'mongoose'
import { ProposalModel, ProposalTargetKind, ProposalProposerKind } from '../proposalModel'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { PerformanceModel } from '../../performance/performanceModel'
import { RunModel } from '../../run/runModel'
import { PersonModel } from '../../person/personModel'
import { ShowModel } from '../../show/showModel'
import { StageModel } from '../../stage/stageModel'
import { createNotification } from '../../../services/notifications/createNotification'
import { incrementEditActivity } from '../../../services/antiAbuse/incrementEditActivity'

// Internal helper called by update mutations when canPerform decides 'queue'.
// Not exposed as a GraphQL mutation — proposers don't call this directly; the
// per-entity update mutations (venueUpdate, etc.) call it on their behalf so
// proposers and direct-publishers use the same field-level inputs.

export interface CreateProposalArgs {
  target: { kind: ProposalTargetKind; id: string | Types.ObjectId }
  proposer: {
    kind: ProposalProposerKind
    userId?: string | Types.ObjectId | null
    dataSourceId?: string | Types.ObjectId | null
    label?: string
  }
  diff: Record<string, { old: any; new: any }>
  submissionVersion: Date
  isJointStewardship?: boolean
  // Optional bridge to PendingImport (scraper proposal wrapping an import).
  pendingImportId?: string | Types.ObjectId | null
  // Phase 7 — set when a non-autoconfirmed user proposes an edit on an
  // unclaimed record. Routes the proposal to the community-review queue.
  isCommunityReview?: boolean
}

export interface CreateProposalResult {
  proposalId: string
  proposal: any
  conflicts: string[]
}

// Field-overlap conflict detection — scans pending proposals on the same
// target whose diff touches any of the same fields as this new one. Returns
// the IDs of conflicting proposals; also updates them to point back.
async function findAndLinkConflicts(
  newProposalId: Types.ObjectId,
  target: { kind: ProposalTargetKind; id: Types.ObjectId },
  diffFields: string[],
): Promise<string[]> {
  if (diffFields.length === 0) return []
  const others = await ProposalModel.find({
    'target.kind': target.kind,
    'target.id': target.id,
    status: 'pending',
    _id: { $ne: newProposalId },
  }).select('_id diff conflictsWithProposalIds')

  const conflictingIds: string[] = []
  for (const other of others) {
    const otherFields = Object.keys(other.diff ?? {})
    const overlap = otherFields.some(f => diffFields.includes(f))
    if (!overlap) continue
    conflictingIds.push(other._id.toString())
    // Backlink — keep both rows aware of each other.
    if (!other.conflictsWithProposalIds.some((id: any) => id.equals(newProposalId))) {
      other.conflictsWithProposalIds.push(newProposalId)
      await other.save()
    }
  }
  return conflictingIds
}

async function resolveClaimantsForTarget(
  target: { kind: ProposalTargetKind; id: Types.ObjectId | string },
): Promise<string[]> {
  // Returns the user IDs that should receive `proposal_received` notifications.
  switch (target.kind) {
    case 'Venue': {
      const v = await VenueModel.findById(target.id).select('claimedBy').lean()
      return v?.claimedBy ? [v.claimedBy.toString()] : []
    }
    case 'ProductionCompany': {
      const c = await ProductionCompanyModel.findById(target.id).select('claimedBy').lean()
      return c?.claimedBy ? [c.claimedBy.toString()] : []
    }
    case 'Person': {
      const p = await PersonModel.findById(target.id).select('claimedBy').lean()
      return p?.claimedBy ? [p.claimedBy.toString()] : []
    }
    case 'Performance': {
      const perf = await PerformanceModel.findById(target.id).select('run venueId').lean()
      if (!perf) return []
      const run = await RunModel.findById(perf.run).select('productionCompany').lean()
      const [v, c] = await Promise.all([
        VenueModel.findById(perf.venueId).select('claimedBy').lean(),
        run?.productionCompany
          ? ProductionCompanyModel.findById(run.productionCompany).select('claimedBy').lean()
          : Promise.resolve(null),
      ])
      const ids = [v?.claimedBy?.toString(), c?.claimedBy?.toString()].filter(Boolean) as string[]
      // De-dup (same user claims both sides)
      return Array.from(new Set(ids))
    }
    default:
      return []
  }
}

async function resolveTargetSummary(
  target: { kind: ProposalTargetKind; id: Types.ObjectId | string },
): Promise<{ name?: string; slug?: string }> {
  const Model = (() => {
    switch (target.kind) {
      case 'Venue': return VenueModel
      case 'ProductionCompany': return ProductionCompanyModel
      case 'Person': return PersonModel
      case 'Show': return ShowModel
      case 'Run': return RunModel
      case 'Performance': return PerformanceModel
      case 'Stage': return StageModel
    }
  })()
  if (!Model) return {}
  const doc: any = await (Model as any).findById(target.id).select('name title slug').lean()
  return { name: doc?.name ?? doc?.title, slug: doc?.slug }
}

export async function createProposal(args: CreateProposalArgs): Promise<CreateProposalResult> {
  const targetId = typeof args.target.id === 'string' ? new Types.ObjectId(args.target.id) : args.target.id

  const proposal = await ProposalModel.create({
    target: { kind: args.target.kind, id: targetId },
    proposer: {
      kind: args.proposer.kind,
      userId: args.proposer.userId ?? null,
      dataSourceId: args.proposer.dataSourceId ?? null,
      label: args.proposer.label,
    },
    diff: args.diff,
    submissionVersion: args.submissionVersion,
    status: 'pending',
    isJointStewardship: !!args.isJointStewardship,
    approvals: [],
    conflictsWithProposalIds: [],
    pendingImportId: args.pendingImportId ?? null,
    isCommunityReview: !!args.isCommunityReview,
  })

  // Phase 7 — User-authored proposals count toward editCount + autoconfirmed
  // gate. Scraper / SyncFeed proposals do not (they don't gate against an
  // anti-abuse threshold).
  if (args.proposer.kind === 'User' && args.proposer.userId) {
    await incrementEditActivity(args.proposer.userId)
  }

  // Conflict detection (Phase 4 D4).
  const diffFields = Object.keys(args.diff)
  const conflictIds = await findAndLinkConflicts(proposal._id, { kind: args.target.kind, id: targetId }, diffFields)
  if (conflictIds.length > 0) {
    proposal.conflictsWithProposalIds = conflictIds.map(id => new Types.ObjectId(id))
    await proposal.save()
  }

  // Notify claimant(s).
  const claimantIds = await resolveClaimantsForTarget({ kind: args.target.kind, id: targetId })
  const summary = await resolveTargetSummary({ kind: args.target.kind, id: targetId })
  for (const recipient of claimantIds) {
    await createNotification({
      recipient,
      kind: 'proposal_received',
      context: {
        proposalId: proposal._id.toString(),
        targetKind: args.target.kind,
        targetId: targetId.toString(),
        targetName: summary.name ?? null,
        targetSlug: summary.slug ?? null,
        proposerLabel: args.proposer.label ?? null,
        proposerKind: args.proposer.kind,
        isJointStewardship: !!args.isJointStewardship,
      },
    })
  }

  return {
    proposalId: proposal._id.toString(),
    proposal,
    conflicts: conflictIds,
  }
}
