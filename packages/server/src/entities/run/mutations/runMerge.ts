import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { RunModel } from '../runModel'
import { PerformanceModel } from '../../performance/performanceModel'
import { CreditModel } from '../../credit/creditModel'
import { ReviewModel } from '../../review/reviewModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'

export const runMerge = mutationWithClientMutationId({
  name: 'runMerge',
  description: 'Merge source run into target run. Reassigns performances, credits, reviews, deletes source (admin only)',
  inputFields: {
    sourceId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the run to merge FROM (will be deleted)'
    },
    targetId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the run to merge INTO (will be kept)'
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
      if (input.sourceId === input.targetId) return { error: 'Cannot merge a run into itself' }

      const source = await RunModel.findById(input.sourceId)
      const target = await RunModel.findById(input.targetId)
      if (!source) return { error: 'Source run not found' }
      if (!target) return { error: 'Target run not found' }

      // Reassign performances, credits, reviews
      await PerformanceModel.updateMany({ run: source._id }, { run: target._id })
      await CreditModel.updateMany({ run: source._id }, { run: target._id })
      await ReviewModel.updateMany({ run: source._id }, { run: target._id })

      // Delete source run
      await RunModel.findByIdAndDelete(source._id)

      return { deletedId: input.sourceId }
    } catch (err) {
      console.error('runMerge error:', err)
      return { error: 'Failed to merge runs' }
    }
  }
})
