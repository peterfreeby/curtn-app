import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'
import { mergeVenueCore } from './mergeVenueCore'

export const venueMerge = mutationWithClientMutationId({
  name: 'venueMerge',
  description: 'Merge source venue into target venue. Reassigns all references, deletes source (admin only)',
  inputFields: {
    sourceId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the venue to merge FROM (will be deleted)'
    },
    targetId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the venue to merge INTO (will be kept)'
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
      const result = await mergeVenueCore(input.sourceId, input.targetId)
      if (!result.ok) return { error: result.error }
      return { deletedId: result.deletedId }
    } catch (err) {
      console.error('venueMerge error:', err)
      const message = err instanceof Error ? err.message : String(err)
      return { error: `Failed to merge venues: ${message}` }
    }
  }
})
