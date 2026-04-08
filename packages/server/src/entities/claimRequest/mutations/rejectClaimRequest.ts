import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { claimRequestType } from '../claimRequestTypes'
import { ClaimRequestModel } from '../claimRequestModel'
import { UserModel } from '../../user/userModel'

export const rejectClaimRequest = mutationWithClientMutationId({
  name: 'rejectClaimRequest',
  description: 'Reject a pending claim request (admin only)',
  inputFields: {
    claimRequestId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the ClaimRequest to reject'
    }
  },
  mutateAndGetPayload: async ({ claimRequestId }: { claimRequestId: string }, ctx: any) => {
    if (!ctx.user) return { error: 'Authentication required' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    const claimRequest = await ClaimRequestModel.findById(claimRequestId)
    if (!claimRequest) return { error: 'Claim request not found' }
    if (claimRequest.status !== 'pending') return { error: `Claim request already ${claimRequest.status}` }

    claimRequest.status = 'rejected'
    claimRequest.reviewedAt = new Date()
    claimRequest.reviewedBy = adminUser._id
    await claimRequest.save()

    return { claimRequest }
  },
  outputFields: {
    ...errorField,
    claimRequest: {
      type: claimRequestType,
      resolve: (response: any) => response.claimRequest
    }
  }
})
