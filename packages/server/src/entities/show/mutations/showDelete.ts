import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { ShowModel } from '../showModel'
import { RunModel } from '../../run/runModel'
import { PerformanceModel } from '../../performance/performanceModel'
import { CreditModel } from '../../credit/creditModel'
import { ReviewModel } from '../../review/reviewModel'
import { WatchlistItemModel } from '../../watchlist/watchlistModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'

export const showDelete = mutationWithClientMutationId({
  name: 'showDelete',
  description: 'Delete a show and all its runs, performances, credits, reviews (admin only)',
  inputFields: {
    showId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the show to delete'
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
      const show = await ShowModel.findById(input.showId)
      if (!show) return { error: 'Show not found' }

      const runs = await RunModel.find({ show: show._id })
      const runIds = runs.map(r => r._id)

      const performances = await PerformanceModel.find({ run: { $in: runIds } })
      const perfIds = performances.map(p => p._id)

      await ReviewModel.deleteMany({ $or: [{ run: { $in: runIds } }, { performance: { $in: perfIds } }] })
      await CreditModel.deleteMany({ run: { $in: runIds } })
      await PerformanceModel.deleteMany({ run: { $in: runIds } })
      await RunModel.deleteMany({ show: show._id })
      await WatchlistItemModel.deleteMany({ show: show._id })
      await ShowModel.findByIdAndDelete(show._id)

      return { deletedId: input.showId }
    } catch (err) {
      console.error('showDelete error:', err)
      return { error: 'Failed to delete show' }
    }
  }
})
