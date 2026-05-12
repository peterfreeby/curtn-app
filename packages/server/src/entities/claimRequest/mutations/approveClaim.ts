import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { claimRequestType } from '../claimRequestTypes'
import { ClaimRequestModel, ClaimTargetKind } from '../claimRequestModel'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../person/personModel'
import { UserModel } from '../../user/userModel'
import { createNotification } from '../../../services/notifications/createNotification'

// Generalized admin-only approval for polymorphic claim requests (Phase 2).
// Transitions the target unit to `claimed-passive`, sets claimedBy + claimedAt,
// and creates an in-app Notification for the claimant.

export const approveClaim = mutationWithClientMutationId({
  name: 'approveClaim',
  description: 'Admin approves a polymorphic claim request. Target unit transitions to claimed-passive.',
  inputFields: {
    claimRequestId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the ClaimRequest to approve'
    },
    reviewerNotes: {
      type: GraphQLString,
      description: 'Optional notes from the admin reviewer'
    }
  },
  outputFields: {
    claimRequest: {
      type: claimRequestType,
      resolve: (response: any) => response.claimRequest
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Authentication required' }

    const { claimRequestId, reviewerNotes } = input as { claimRequestId: string, reviewerNotes?: string }

    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    const claimRequest = await ClaimRequestModel.findById(claimRequestId)
    if (!claimRequest) return { error: 'Claim request not found' }
    if (claimRequest.status !== 'pending') return { error: `Claim request already ${claimRequest.status}` }
    if (!claimRequest.target?.kind || !claimRequest.target?.id) {
      return { error: 'Claim request has no polymorphic target. Use approveClaimRequest for legacy Person-only claims.' }
    }

    const unit = await fetchUnit(claimRequest.target.kind, claimRequest.target.id.toString())
    if (!unit) return { error: `${claimRequest.target.kind} not found` }
    if (unit.claimState === 'claimed-passive' || unit.claimState === 'claimed-synced') {
      return { error: 'Target unit is already claimed by another user' }
    }

    // Transition unit → claimed-passive
    unit.claimState = 'claimed-passive'
    unit.claimedBy = claimRequest.user
    unit.claimedAt = new Date()
    unit.lastClaimantActivityAt = new Date()
    await unit.save()

    // For Person targets, also set the legacy bidirectional link so existing
    // `user` GraphQL resolvers keep working. Phase-3 cleanup will deprecate.
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
    claimRequest.reviewedAt = new Date()
    claimRequest.reviewedBy = adminUser._id
    if (reviewerNotes) claimRequest.reviewerNotes = reviewerNotes
    await claimRequest.save()

    await createNotification({
      recipient: claimRequest.user,
      kind: 'claim_approved',
      context: {
        targetKind: claimRequest.target.kind,
        targetId: unit._id.toString(),
        targetName: unit.name,
        targetSlug: unit.slug ?? null,
        reviewerNotes: reviewerNotes || null,
      }
    })

    return { claimRequest }
  }
})

async function fetchUnit(kind: ClaimTargetKind, id: string): Promise<any> {
  if (kind === 'venue') return VenueModel.findById(id)
  if (kind === 'productionCompany') return ProductionCompanyModel.findById(id)
  if (kind === 'person') return PersonModel.findById(id)
  return null
}
