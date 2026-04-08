import { GraphQLFieldConfig } from 'graphql'
import { connectionArgs } from 'graphql-relay'
import { ReviewConnection } from '../../review/reviewTypes'
import { ReviewModel } from '../../review/reviewModel'
import { FollowModel } from '../followModel'
import { applyCursorToAggregate, buildConnection } from '../../../graphql/cursorPagination'

export const feedReviews: GraphQLFieldConfig<any, any> = {
  type: ReviewConnection,
  description: 'Reviews from users the current user follows',
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

    const reviews = await ReviewModel.aggregate(pipeline)
    return buildConnection(reviews, { first: args.first, sortField: 'createdAt' })
  }
}
