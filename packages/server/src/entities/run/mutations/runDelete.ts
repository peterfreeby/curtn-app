import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { RunModel } from '../runModel'
import { PerformanceModel } from '../../performance/performanceModel'
import { CreditModel } from '../../credit/creditModel'
import { ReviewModel } from '../../review/reviewModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'

export const runDelete = mutationWithClientMutationId({
  name: 'runDelete',
  description: 'Delete a run and all its performances, credits, reviews (admin only)',
  inputFields: {
    runId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the run to delete'
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
      const run = await RunModel.findById(input.runId)
      if (!run) return { error: 'Run not found' }

      const performances = await PerformanceModel.find({ run: run._id })
      const perfIds = performances.map(p => p._id)

      await ReviewModel.deleteMany({ $or: [{ run: run._id }, { performance: { $in: perfIds } }] })
      await CreditModel.deleteMany({ run: run._id })
      await PerformanceModel.deleteMany({ run: run._id })
      await RunModel.findByIdAndDelete(run._id)

      return { deletedId: input.runId }
    } catch (err) {
      console.error('runDelete error:', err)
      return { error: 'Failed to delete run' }
    }
  }
})
