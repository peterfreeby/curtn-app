import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLNonNull
} from 'graphql'
import {
  fromGlobalId,
  mutationWithClientMutationId
} from 'graphql-relay'
import { FollowModel } from '../followModel'
import { errorField } from '../../../graphql/errorField'

export const followToggle = mutationWithClientMutationId({
  name: 'followToggle',
  description: 'Toggle follow/unfollow a user',
  inputFields: {
    userId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'The global ID of the user to follow/unfollow'
    }
  },
  outputFields: {
    isFollowing: {
      type: GraphQLBoolean,
      resolve: response => response.isFollowing
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ userId }, ctx) => {
    if (!ctx.user) {
      return { isFollowing: false, error: 'Unauthorized' }
    }

    const { id: targetId } = fromGlobalId(userId)
    const followerId = ctx.user.id

    if (followerId === targetId) {
      return { isFollowing: false, error: 'Cannot follow yourself' }
    }

    const existing = await FollowModel.findOne({
      follower: followerId,
      following: targetId
    })

    if (existing) {
      await FollowModel.deleteOne({ _id: existing._id })
      return { isFollowing: false }
    }

    await new FollowModel({
      follower: followerId,
      following: targetId
    }).save()

    return { isFollowing: true }
  }
})
