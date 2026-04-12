import { GraphQLFieldConfig } from 'graphql'
import { connectionArgs } from 'graphql-relay'
import { SeenConnection } from '../../seen/seenTypes'
import { SeenModel } from '../../seen/seenModel'
import { FollowModel } from '../followModel'
import { applyCursorToAggregate, buildConnection } from '../../../graphql/cursorPagination'

export const feedSeen: GraphQLFieldConfig<any, any> = {
  type: SeenConnection,
  description: 'Seen records from users the current user follows',
  args: {
    ...connectionArgs
  },
  resolve: async (_, args, ctx) => {
    const empty = { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } }

    if (!ctx.user) return empty

    const follows = await FollowModel.find({ follower: ctx.user.id }).select('following')
    const followingIds = follows.map(f => f.following)

    if (followingIds.length === 0) return empty

    const pipeline = applyCursorToAggregate(
      [{ $match: { user: { $in: followingIds } } }],
      { after: args.after, first: args.first, sortField: 'createdAt', sortDirection: -1 }
    )

    const docs = await SeenModel.aggregate(pipeline)
    return buildConnection(docs, { first: args.first, sortField: 'createdAt' })
  }
}
