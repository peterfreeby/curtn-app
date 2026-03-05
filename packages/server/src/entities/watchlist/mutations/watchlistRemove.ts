import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLInt,
  GraphQLNonNull
} from 'graphql'
import {
  fromGlobalId,
  mutationWithClientMutationId
} from 'graphql-relay'
import { WatchlistItemModel } from '../watchlistModel'
import { errorField } from '../../../graphql/errorField'

export const watchlistRemove = mutationWithClientMutationId({
  name: 'watchlistRemove',
  description: 'Remove a show from your watchlist',
  inputFields: {
    showId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'The global ID of the show to remove'
    }
  },
  outputFields: {
    onWatchlist: {
      type: GraphQLBoolean,
      resolve: response => response.onWatchlist
    },
    watchlistCount: {
      type: GraphQLInt,
      resolve: response => response.watchlistCount
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ showId }, ctx) => {
    if (!ctx.user) {
      return { onWatchlist: false, error: 'Unauthorized' }
    }

    const { id: targetShowId } = fromGlobalId(showId)

    await WatchlistItemModel.deleteOne({ user: ctx.user.id, show: targetShowId })

    const watchlistCount = await WatchlistItemModel.countDocuments({ show: targetShowId })

    return { onWatchlist: false, watchlistCount }
  }
})
