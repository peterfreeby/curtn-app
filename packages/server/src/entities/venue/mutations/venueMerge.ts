import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { VenueModel } from '../venueModel'
import { RunModel } from '../../run/runModel'
import { PerformanceModel } from '../../performance/performanceModel'
import { DataSourceModel } from '../../dataSource/dataSourceModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'

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
      if (input.sourceId === input.targetId) return { error: 'Cannot merge a venue into itself' }

      const source = await VenueModel.findById(input.sourceId)
      const target = await VenueModel.findById(input.targetId)
      if (!source) return { error: 'Source venue not found' }
      if (!target) return { error: 'Target venue not found' }

      // Reassign performances
      await PerformanceModel.updateMany({ venueId: source._id }, { venueId: target._id })

      // Reassign runs: replace source venue ID with target in the venues array
      await RunModel.updateMany(
        { venues: source._id },
        { $addToSet: { venues: target._id } }
      )
      await RunModel.updateMany(
        { venues: source._id },
        { $pull: { venues: source._id } }
      )

      // Reassign data sources
      await DataSourceModel.updateMany({ defaultVenue: source._id }, { defaultVenue: target._id })

      // Move stages to target venue
      const { StageModel } = require('../../stage/stageModel')
      await StageModel.updateMany({ venue: source._id }, { venue: target._id })

      // Delete source venue
      await VenueModel.findByIdAndDelete(source._id)

      return { deletedId: input.sourceId }
    } catch (err) {
      console.error('venueMerge error:', err)
      return { error: 'Failed to merge venues' }
    }
  }
})
