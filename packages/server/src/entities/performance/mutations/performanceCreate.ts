import { GraphQLNonNull, GraphQLString, GraphQLBoolean } from 'graphql'
import { mutationWithClientMutationId, fromGlobalId } from 'graphql-relay'
import { performanceType } from '../performanceTypes'
import { PerformanceModel } from '../performanceModel'
import { RunModel } from '../../run/runModel'
import { errorField } from '../../../graphql/errorField'

export const performanceCreate = mutationWithClientMutationId({
  name: 'performanceCreate',
  description: 'Create a new performance (single showing)',
  inputFields: {
    runId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Run global ID'
    },
    date: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Performance date (ISO string)'
    },
    time: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Performance time (e.g. "7:30 PM")'
    },
    venueId: {
      type: GraphQLString,
      description: 'Venue global ID (optional — a performance can be logged without a venue)'
    },
    ticketUrl: {
      type: GraphQLString,
      description: 'URL to purchase tickets'
    },
    soldOut: {
      type: GraphQLBoolean,
      description: 'Whether the performance is sold out'
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
    if (!ctx.user) {
      return { error: 'Unauthorized', performance: null }
    }

    try {
      const runObjectId = fromGlobalId(input.runId).id
      const venueObjectId = input.venueId ? fromGlobalId(input.venueId).id : undefined
      const perfDate = new Date(input.date)

      const performance = await new PerformanceModel({
        run: runObjectId,
        date: perfDate,
        time: input.time,
        ...(venueObjectId ? { venueId: venueObjectId } : {}),
        ticketUrl: input.ticketUrl,
        soldOut: input.soldOut || false,
        submittedBy: ctx.user.id
      }).save()

      // Update Run's date range if this performance extends it
      const run = await RunModel.findById(runObjectId)
      if (run) {
        let updated = false
        if (!run.startDate || perfDate < run.startDate) {
          run.startDate = perfDate
          updated = true
        }
        if (!run.endDate || perfDate > run.endDate) {
          run.endDate = perfDate
          updated = true
        }
        if (updated) await run.save()
      }

      return { performance }
    } catch {
      return { error: 'Failed to create performance' }
    }
  }
})
