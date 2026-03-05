import { GraphQLFieldConfig } from 'graphql'
import { connectionArgs, connectionFromArray } from 'graphql-relay'
import { ReviewConnection } from '../../review/reviewTypes'
import { ReviewModel } from '../../review/reviewModel'
import { FollowModel } from '../followModel'

export const feedReviews: GraphQLFieldConfig<any, any> = {
  type: ReviewConnection,
  description: 'Reviews from users the current user follows',
  args: {
    ...connectionArgs
  },
  resolve: async (_, args, ctx) => {
    if (!ctx.user) {
      return connectionFromArray([], args)
    }

    const follows = await FollowModel.find({ follower: ctx.user.id }).select('following')
    const followingIds = follows.map(f => f.following)

    if (followingIds.length === 0) {
      return connectionFromArray([], args)
    }

    const reviews = await ReviewModel.aggregate([
      { $match: { user: { $in: followingIds } } },
      { $sort: { createdAt: -1 } }
    ])

    return connectionFromArray(reviews, args)
  }
}
