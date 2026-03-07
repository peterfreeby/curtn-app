import { GraphQLNonNull, GraphQLString, GraphQLBoolean } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { performanceType } from '../performanceTypes'
import { PerformanceModel } from '../performanceModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'

export const performanceUpdate = mutationWithClientMutationId({
  name: 'performanceUpdate',
  description: 'Update an existing performance (admin only)',
  inputFields: {
    performanceId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the performance to update'
    },
    date: {
      type: GraphQLString,
      description: 'Performance date (ISO string)'
    },
    time: {
      type: GraphQLString,
      description: 'Performance time'
    },
    ticketUrl: {
      type: GraphQLString,
      description: 'Ticket purchase URL'
    },
    soldOut: {
      type: GraphQLBoolean,
      description: 'Whether the performance is sold out'
    },
    description: {
      type: GraphQLString,
      description: 'Performance-level description override'
    }
  },
  outputFields: {
    performance: {
      type: performanceType,
      resolve: response => response.performance
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    try {
      const performance = await PerformanceModel.findById(input.performanceId)
      if (!performance) return { error: 'Performance not found' }

      const updates: Record<string, any> = {}

      if (input.date !== undefined) updates.date = new Date(input.date)
      if (input.time !== undefined) updates.time = input.time
      if (input.ticketUrl !== undefined) updates.ticketUrl = input.ticketUrl
      if (input.soldOut !== undefined) updates.soldOut = input.soldOut
      if (input.description !== undefined) updates['metadataOverrides.description'] = input.description

      if (Object.keys(updates).length === 0) {
        return { performance }
      }

      const updated = await PerformanceModel.findByIdAndUpdate(input.performanceId, updates, { new: true })
      return { performance: updated }
    } catch (err) {
      console.error('performanceUpdate error:', err)
      return { error: 'Failed to update performance' }
    }
  }
})
