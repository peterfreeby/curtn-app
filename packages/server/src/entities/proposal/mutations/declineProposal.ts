import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { Types } from 'mongoose'
import { errorField } from '../../../graphql/errorField'
import { ProposalModel, ProposalTargetKind } from '../proposalModel'
import { proposalType } from '../proposalTypes'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../person/personModel'
import { PerformanceModel } from '../../performance/performanceModel'
import { RunModel } from '../../run/runModel'
import { UserModel } from '../../user/userModel'
import { createNotification } from '../../../services/notifications/createNotification'

// Phase 4 — declineProposal. Either claimant can decline a joint proposal;
// the proposal is terminal regardless of partial approvals already recorded.

async function userCanDecline(
  kind: ProposalTargetKind,
  targetId: Types.ObjectId,
  userId: string,
  isJoint: boolean,
): Promise<boolean> {
  const adminUser = await UserModel.findById(userId).select('isAdmin').lean()
  if (adminUser?.isAdmin) return true
  if (isJoint && kind === 'Performance') {
    const perf = await PerformanceModel.findById(targetId).select('run venueId').lean()
    if (!perf) return false
    const run = await RunModel.findById(perf.run).select('productionCompany').lean()
    const [v, c] = await Promise.all([
      VenueModel.findById(perf.venueId).select('claimedBy').lean(),
      run?.productionCompany
        ? ProductionCompanyModel.findById(run.productionCompany).select('claimedBy').lean()
        : Promise.resolve(null),
    ])
    return v?.claimedBy?.toString() === userId || c?.claimedBy?.toString() === userId
  }
  switch (kind) {
    case 'Venue': {
      const v = await VenueModel.findById(targetId).select('claimedBy').lean()
      return v?.claimedBy?.toString() === userId
    }
    case 'ProductionCompany': {
      const c = await ProductionCompanyModel.findById(targetId).select('claimedBy').lean()
      return c?.claimedBy?.toString() === userId
    }
    case 'Person': {
      const p = await PersonModel.findById(targetId).select('claimedBy').lean()
      return p?.claimedBy?.toString() === userId
    }
    default:
      return false
  }
}

export const declineProposal = mutationWithClientMutationId({
  name: 'declineProposal',
  description: 'Decline a proposal. Either claimant kills a joint proposal regardless of partial approvals.',
  inputFields: {
    proposalId: { type: new GraphQLNonNull(GraphQLString) },
    reason: { type: GraphQLString },
  },
  outputFields: {
    proposal: { type: proposalType, resolve: (r: any) => r.proposal },
    ...errorField,
  },
  mutateAndGetPayload: async ({ proposalId, reason }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    const proposal = await ProposalModel.findById(proposalId)
    if (!proposal) return { error: 'Proposal not found' }
    if (proposal.status !== 'pending') return { error: `Proposal already ${proposal.status}` }

    const allowed = await userCanDecline(
      proposal.target.kind as ProposalTargetKind,
      proposal.target.id as Types.ObjectId,
      ctx.user.id,
      !!proposal.isJointStewardship,
    )
    if (!allowed) return { error: 'You are not authorized to decline this proposal' }

    proposal.status = 'declined'
    proposal.declinedBy = ctx.user.id
    proposal.declinedAt = new Date()
    if (reason) proposal.declineReason = reason
    await proposal.save()

    if (proposal.proposer?.kind === 'User' && proposal.proposer.userId) {
      await createNotification({
        recipient: proposal.proposer.userId,
        kind: 'proposal_declined',
        context: {
          proposalId: proposal._id.toString(),
          targetKind: proposal.target.kind,
          targetId: (proposal.target.id as Types.ObjectId).toString(),
          declineReason: reason ?? null,
        },
      })
    }

    return { proposal }
  }
})
