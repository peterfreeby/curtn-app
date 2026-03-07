import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { PerformanceModel } from '../performanceModel'
import { ReviewModel } from '../../review/reviewModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'

export const performanceMerge = mutationWithClientMutationId({
  name: 'performanceMerge',
  description: 'Merge source performance into target. Reassigns reviews, deletes source (admin only)',
  inputFields: {
    sourceId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the performance to merge FROM (will be deleted)'
    },
    targetId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the performance to merge INTO (will be kept)'
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
      if (input.sourceId === input.targetId) return { error: 'Cannot merge a performance into itself' }

      const source = await PerformanceModel.findById(input.sourceId)
      const target = await PerformanceModel.findById(input.targetId)
      if (!source) return { error: 'Source performance not found' }
      if (!target) return { error: 'Target performance not found' }

      await ReviewModel.updateMany({ performance: source._id }, { performance: target._id })
      await PerformanceModel.findByIdAndDelete(source._id)

      return { deletedId: input.sourceId }
    } catch (err) {
      console.error('performanceMerge error:', err)
      return { error: 'Failed to merge performances' }
    }
  }
})
