import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { PerformanceModel } from '../performanceModel'
import { ReviewModel } from '../../review/reviewModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'

export const performanceDelete = mutationWithClientMutationId({
  name: 'performanceDelete',
  description: 'Delete a performance and its reviews (admin only)',
  inputFields: {
    performanceId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the performance to delete'
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
      const perf = await PerformanceModel.findById(input.performanceId)
      if (!perf) return { error: 'Performance not found' }

      await ReviewModel.deleteMany({ performance: perf._id })
      await PerformanceModel.findByIdAndDelete(perf._id)

      return { deletedId: input.performanceId }
    } catch (err) {
      console.error('performanceDelete error:', err)
      return { error: 'Failed to delete performance' }
    }
  }
})
