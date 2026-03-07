import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { VenueModel } from '../venueModel'
import { RunModel } from '../../run/runModel'
import { PerformanceModel } from '../../performance/performanceModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'

export const venueDelete = mutationWithClientMutationId({
  name: 'venueDelete',
  description: 'Delete a venue if no runs or performances reference it (admin only)',
  inputFields: {
    venueId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the venue to delete'
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
      const venue = await VenueModel.findById(input.venueId)
      if (!venue) return { error: 'Venue not found' }

      // Block delete if venue is referenced
      const runCount = await RunModel.countDocuments({ venues: venue._id })
      const perfCount = await PerformanceModel.countDocuments({ venueId: venue._id })
      if (runCount > 0 || perfCount > 0) {
        return { error: `Cannot delete: venue is referenced by ${runCount} run(s) and ${perfCount} performance(s). Merge into another venue instead.` }
      }

      const { StageModel } = require('../../stage/stageModel')
      await StageModel.deleteMany({ venue: venue._id })
      await VenueModel.findByIdAndDelete(venue._id)

      return { deletedId: input.venueId }
    } catch (err) {
      console.error('venueDelete error:', err)
      return { error: 'Failed to delete venue' }
    }
  }
})
