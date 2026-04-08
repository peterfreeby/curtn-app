import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { PersonModel } from '../personModel'
import { CreditModel } from '../../credit/creditModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'

export const personDelete = mutationWithClientMutationId({
  name: 'personDelete',
  description: 'Delete a person and all their credits (admin only)',
  inputFields: {
    personId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the person to delete'
    }
  },
  outputFields: {
    deletedId: {
      type: GraphQLString,
      resolve: response => response.deletedId
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    try {
      const person = await PersonModel.findById(input.personId)
      if (!person) return { error: 'Person not found' }

      // Clear claim link if person was claimed
      if (person.userId) {
        await UserModel.findByIdAndUpdate(person.userId, { personId: undefined })
      }

      await CreditModel.deleteMany({ person: person._id })
      await PersonModel.findByIdAndDelete(person._id)

      return { deletedId: input.personId }
    } catch (err) {
      console.error('personDelete error:', err)
      return { error: 'Failed to delete person' }
    }
  }
})
