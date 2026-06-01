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

      // Find-or-create: a performance is uniquely identified by
      // run + calendar date (UTC) + time + venue. Without this, every log of
      // the same showing spawns a duplicate performance (and SmartLogForm logs
      // always go through here). Match the whole day in UTC since dates are
      // stored as UTC midnight.
      const dayStart = new Date(Date.UTC(
        perfDate.getUTCFullYear(), perfDate.getUTCMonth(), perfDate.getUTCDate()
      ))
      const dayEnd = new Date(dayStart)
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

      const performance = await PerformanceModel.findOneAndUpdate(
        {
          run: runObjectId,
          date: { $gte: dayStart, $lt: dayEnd },
          time: input.time,
          venueId: venueObjectId ?? null
        },
        {
          $setOnInsert: {
            run: runObjectId,
            date: perfDate,
            time: input.time,
            ...(venueObjectId ? { venueId: venueObjectId } : {}),
            ticketUrl: input.ticketUrl,
            soldOut: input.soldOut || false,
            submittedBy: ctx.user.id
          }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )

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
