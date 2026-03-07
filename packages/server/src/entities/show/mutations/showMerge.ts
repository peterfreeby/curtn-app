import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { showType } from '../showTypes'
import { ShowModel } from '../showModel'
import { RunModel } from '../../run/runModel'
import { WatchlistItemModel } from '../../watchlist/watchlistModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'

export const showMerge = mutationWithClientMutationId({
  name: 'showMerge',
  description: 'Merge source show into target show. Reassigns all runs, deletes source (admin only)',
  inputFields: {
    sourceId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the show to merge FROM (will be deleted)'
    },
    targetId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the show to merge INTO (will be kept)'
    }
  },
  outputFields: {
    show: {
      type: showType,
      resolve: response => response.show
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    try {
      if (input.sourceId === input.targetId) return { error: 'Cannot merge a show into itself' }

      const source = await ShowModel.findById(input.sourceId)
      const target = await ShowModel.findById(input.targetId)
      if (!source) return { error: 'Source show not found' }
      if (!target) return { error: 'Target show not found' }

      // Reassign all runs from source to target
      await RunModel.updateMany({ show: source._id }, { show: target._id })

      // Merge watchlist entries (skip duplicates)
      const targetWatchlists = await WatchlistItemModel.find({ show: target._id })
      const targetWatchlistUsers = new Set(targetWatchlists.map(w => w.user.toString()))
      const sourceWatchlists = await WatchlistItemModel.find({ show: source._id })
      for (const sw of sourceWatchlists) {
        if (!targetWatchlistUsers.has(sw.user.toString())) {
          await WatchlistItemModel.create({ user: sw.user, show: target._id })
        }
      }
      await WatchlistItemModel.deleteMany({ show: source._id })

      // Delete source show
      await ShowModel.findByIdAndDelete(source._id)

      const updated = await ShowModel.findById(target._id)
      return { show: updated }
    } catch (err) {
      console.error('showMerge error:', err)
      return { error: 'Failed to merge shows' }
    }
  }
})
