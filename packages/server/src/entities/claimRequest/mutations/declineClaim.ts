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

// Generalized admin-only decline for polymorphic claim requests (Phase 2).
// Reverts the target unit back to `unclaimed` if no other pending claims remain,
// and creates an in-app Notification for the requester.

export const declineClaim = mutationWithClientMutationId({
  name: 'declineClaim',
  description: 'Admin declines a polymorphic claim request. Target unit reverts to unclaimed if no other pending requests exist.',
  inputFields: {
    claimRequestId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the ClaimRequest to decline'
    },
    reviewerNotes: {
      type: GraphQLString,
      description: 'Optional notes from the admin reviewer (visible to the requester)'
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
      return { error: 'Claim request has no polymorphic target. Use rejectClaimRequest for legacy Person-only claims.' }
    }

    claimRequest.status = 'rejected'
    claimRequest.reviewedAt = new Date()
    claimRequest.reviewedBy = adminUser._id
    if (reviewerNotes) claimRequest.reviewerNotes = reviewerNotes
    await claimRequest.save()

    // If no other pending claims on the same target, revert to unclaimed.
    const otherPending = await ClaimRequestModel.findOne({
      'target.kind': claimRequest.target.kind,
      'target.id': claimRequest.target.id,
      status: 'pending',
      _id: { $ne: claimRequest._id },
    })

    if (!otherPending) {
      const unit = await fetchUnit(claimRequest.target.kind, claimRequest.target.id.toString())
      if (unit && unit.claimState === 'provisionally-claimed') {
        unit.claimState = 'unclaimed'
        await unit.save()
      }
    }

    const unitForName = await fetchUnit(claimRequest.target.kind, claimRequest.target.id.toString())

    await createNotification({
      recipient: claimRequest.user,
      kind: 'claim_declined',
      context: {
        targetKind: claimRequest.target.kind,
        targetId: claimRequest.target.id.toString(),
        targetName: unitForName?.name ?? null,
        targetSlug: unitForName?.slug ?? null,
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
