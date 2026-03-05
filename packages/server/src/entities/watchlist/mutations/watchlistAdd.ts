import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLString
} from 'graphql'
import {
  fromGlobalId,
  mutationWithClientMutationId
} from 'graphql-relay'
import { WatchlistItemModel } from '../watchlistModel'
import { errorField } from '../../../graphql/errorField'

export const watchlistAdd = mutationWithClientMutationId({
  name: 'watchlistAdd',
  description: 'Add a show to your watchlist, or update the note if already added',
  inputFields: {
    showId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'The global ID of the show to add'
    },
    note: {
      type: GraphQLString,
      description: 'Optional note (e.g. "my friend said this is amazing")'
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
  mutateAndGetPayload: async ({ showId, note }, ctx) => {
    if (!ctx.user) {
      return { onWatchlist: false, error: 'Unauthorized' }
    }

    const { id: targetShowId } = fromGlobalId(showId)

    await WatchlistItemModel.findOneAndUpdate(
      { user: ctx.user.id, show: targetShowId },
      { user: ctx.user.id, show: targetShowId, note },
      { upsert: true, new: true }
    )

    const watchlistCount = await WatchlistItemModel.countDocuments({ show: targetShowId })

    return { onWatchlist: true, watchlistCount }
  }
})
