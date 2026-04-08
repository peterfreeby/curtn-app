import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { claimRequestType } from '../claimRequestTypes'
import { ClaimRequestModel } from '../claimRequestModel'
import { PersonModel } from '../../person/personModel'
import { UserModel } from '../../user/userModel'
import { personType } from '../../person/personTypes'

export const submitClaimRequestNewPerson = mutationWithClientMutationId({
  name: 'submitClaimRequestNewPerson',
  description: 'Create a new Person record and submit a claim request for it',
  inputFields: {
    personName: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Name for the new Person record'
    },
    message: {
      type: GraphQLString,
      description: 'Optional note explaining why this is you'
    }
  },
  mutateAndGetPayload: async ({ personName, message }: { personName: string, message?: string }, ctx: any) => {
    if (!ctx.user) return { error: 'Authentication required' }

    const user = await UserModel.findById(ctx.user.id)
    if (!user) return { error: 'User not found' }
    if (user.personId) return { error: 'You have already claimed a person profile' }

    const existingPending = await ClaimRequestModel.findOne({ user: ctx.user.id, status: 'pending' })
    if (existingPending) return { error: 'You already have a pending claim request' }

    const slug = personName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    // Find or create Person by slug
    let person = await PersonModel.findOne({ slug })
    if (!person) {
      person = await new PersonModel({
        name: personName.trim(),
        slug,
        submittedBy: user._id
      }).save()
    }

    if (person.userId) return { error: 'A person with this name has already been claimed' }

    const claimRequest = await new ClaimRequestModel({
      user: user._id,
      person: person._id,
      message: message || undefined
    }).save()

    return { claimRequest, person }
  },
  outputFields: {
    ...errorField,
    claimRequest: {
      type: claimRequestType,
      resolve: (response: any) => response.claimRequest
    },
    person: {
      type: personType,
      resolve: (response: any) => response.person
    }
  }
})
