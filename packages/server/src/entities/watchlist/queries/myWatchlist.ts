import { GraphQLFieldConfig } from 'graphql'
import { connectionArgs, connectionFromArray } from 'graphql-relay'
import { ShowConnection } from '../../show/showTypes'
import { WatchlistItemModel } from '../watchlistModel'
import { ShowModel } from '../../show/showModel'

export const myWatchlist: GraphQLFieldConfig<any, any> = {
  type: ShowConnection,
  description: 'Shows on the current user\'s watchlist, sorted by most recently added',
  args: {
    ...connectionArgs
  },
  resolve: async (_, args, ctx) => {
    if (!ctx.user) {
      return connectionFromArray([], args)
    }

    const watchlistItems = await WatchlistItemModel.find({ user: ctx.user.id })
      .sort({ createdAt: -1 })
      .select('show')

    if (watchlistItems.length === 0) {
      return connectionFromArray([], args)
    }

    const showIds = watchlistItems.map(item => item.show)
    const shows = await ShowModel.find({ _id: { $in: showIds } })

    // Preserve the watchlist ordering (createdAt desc)
    const showMap = new Map(shows.map(s => [s._id.toString(), s]))
    const ordered = showIds
      .map(id => showMap.get(id.toString()))
      .filter(Boolean)

    return connectionFromArray(ordered, args)
  }
}
