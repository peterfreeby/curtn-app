import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId, fromGlobalId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { userType } from '../userTypes'
import { UserModel } from '../userModel'
import { PersonModel } from '../../person/personModel'

export const userClaimPerson = mutationWithClientMutationId({
  name: 'userClaimPerson',
  description: 'Link the current user to a Person entity (claim credits)',
  inputFields: {
    personId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Global ID of the Person to claim'
    }
  },
  mutateAndGetPayload: async ({ personId }: { personId: string }, ctx: any) => {
    if (!ctx.user) {
      return { error: 'Authentication required' }
    }

    const { id: mongoPersonId } = fromGlobalId(personId)

    const person = await PersonModel.findById(mongoPersonId)
    if (!person) {
      return { error: 'Person not found' }
    }

    // Check if this person is already claimed by someone else
    if (person.userId && person.userId.toString() !== ctx.user.id) {
      return { error: 'This person has already been claimed by another user' }
    }

    // Check if this user already has a person claimed
    const user = await UserModel.findById(ctx.user.id)
    if (!user) {
      return { error: 'User not found' }
    }
    if (user.personId && user.personId.toString() !== mongoPersonId) {
      return { error: 'You have already claimed a different person. Unclaim first to switch.' }
    }

    // Set bidirectional link
    user.personId = person._id
    person.userId = user._id
    await Promise.all([user.save(), person.save()])

    return { user }
  },
  outputFields: {
    ...errorField,
    user: {
      type: userType,
      resolve: (response: any) => response.user
    }
  }
})
