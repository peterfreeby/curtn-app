import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId, fromGlobalId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { claimRequestType } from '../claimRequestTypes'
import { ClaimRequestModel } from '../claimRequestModel'
import { PersonModel } from '../../person/personModel'
import { UserModel } from '../../user/userModel'

export const submitClaimRequest = mutationWithClientMutationId({
  name: 'submitClaimRequest',
  description: 'Submit a request to claim a Person profile (pending admin approval)',
  inputFields: {
    personId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Global ID of the Person to claim'
    },
    message: {
      type: GraphQLString,
      description: 'Optional note explaining why this is you'
    }
  },
  mutateAndGetPayload: async ({ personId, message }: { personId: string, message?: string }, ctx: any) => {
    if (!ctx.user) return { error: 'Authentication required' }

    const { id: mongoPersonId } = fromGlobalId(personId)

    const person = await PersonModel.findById(mongoPersonId)
    if (!person) return { error: 'Person not found' }

    if (person.userId) return { error: 'This person has already been claimed' }

    const user = await UserModel.findById(ctx.user.id)
    if (!user) return { error: 'User not found' }
    if (user.personId) return { error: 'You have already claimed a person profile' }

    const existingPending = await ClaimRequestModel.findOne({ user: ctx.user.id, status: 'pending' })
    if (existingPending) return { error: 'You already have a pending claim request' }

    const claimRequest = await new ClaimRequestModel({
      user: user._id,
      person: person._id,
      message: message || undefined
    }).save()

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
