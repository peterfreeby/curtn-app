import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { claimRequestType } from '../claimRequestTypes'
import { ClaimRequestModel } from '../claimRequestModel'
import { PersonModel } from '../../person/personModel'
import { UserModel } from '../../user/userModel'

export const approveClaimRequest = mutationWithClientMutationId({
  name: 'approveClaimRequest',
  description: 'Approve a pending claim request, linking the user to the person (admin only)',
  inputFields: {
    claimRequestId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the ClaimRequest to approve'
    }
  },
  mutateAndGetPayload: async ({ claimRequestId }: { claimRequestId: string }, ctx: any) => {
    if (!ctx.user) return { error: 'Authentication required' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    const claimRequest = await ClaimRequestModel.findById(claimRequestId)
    if (!claimRequest) return { error: 'Claim request not found' }
    if (claimRequest.status !== 'pending') return { error: `Claim request already ${claimRequest.status}` }

    const person = await PersonModel.findById(claimRequest.person)
    if (!person) return { error: 'Person not found' }
    if (person.userId) return { error: 'This person has already been claimed by another user' }

    const user = await UserModel.findById(claimRequest.user)
    if (!user) return { error: 'Requesting user not found' }
    if (user.personId) return { error: 'This user has already claimed a different person' }

    // Execute bidirectional link
    user.personId = person._id
    person.userId = user._id
    await Promise.all([user.save(), person.save()])

    // Mark approved
    claimRequest.status = 'approved'
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
