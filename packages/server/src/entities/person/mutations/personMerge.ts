import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { personType } from '../personTypes'
import { PersonModel } from '../personModel'
import { CreditModel } from '../../credit/creditModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'

export const personMerge = mutationWithClientMutationId({
  name: 'personMerge',
  description: 'Merge source person into target person. Reassigns all credits, deletes source (admin only)',
  inputFields: {
    sourceId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the person to merge FROM (will be deleted)'
    },
    targetId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the person to merge INTO (will be kept)'
    }
  },
  outputFields: {
    person: {
      type: personType,
      resolve: response => response.person
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    try {
      if (input.sourceId === input.targetId) return { error: 'Cannot merge a person into themselves' }

      const source = await PersonModel.findById(input.sourceId)
      const target = await PersonModel.findById(input.targetId)
      if (!source) return { error: 'Source person not found' }
      if (!target) return { error: 'Target person not found' }

      // Reassign credits, skipping duplicates (same person+run+role)
      const sourceCredits = await CreditModel.find({ person: source._id })
      for (const credit of sourceCredits) {
        const existing = await CreditModel.findOne({
          person: target._id,
          run: credit.run,
          role: credit.role
        })
        if (existing) {
          await CreditModel.findByIdAndDelete(credit._id)
        } else {
          await CreditModel.findByIdAndUpdate(credit._id, { person: target._id })
        }
      }

      await PersonModel.findByIdAndDelete(source._id)

      const updated = await PersonModel.findById(target._id)
      return { person: updated }
    } catch (err) {
      console.error('personMerge error:', err)
      return { error: 'Failed to merge people' }
    }
  }
})
