import { GraphQLFieldConfig, GraphQLID, GraphQLNonNull, GraphQLString } from 'graphql'
import { PerformanceConnection, performanceType } from '../performanceTypes'
import { PerformanceModel } from '../performanceModel'
import { RunModel } from '../../run/runModel'
import { VenueModel } from '../../venue/venueModel'
import { connectionArgs, connectionFromArray, fromGlobalId } from 'graphql-relay'

export const singlePerformance: GraphQLFieldConfig<any, any, { id: string }> = {
  type: performanceType,
  args: {
    id: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Performance ID'
    }
  },
  resolve: async (_, args) => {
    try {
      const { id } = fromGlobalId(args.id)
      return await PerformanceModel.findById(id)
    } catch {
      return null
    }
  }
}

export const performancesByRun: GraphQLFieldConfig<any, any, { runId: string }> = {
  type: PerformanceConnection,
  args: {
    ...connectionArgs,
    runId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Run ID'
    }
  },
  resolve: async (_, args) => {
    const { runId, ...connArgs } = args
    try {
      const { id } = fromGlobalId(runId)
      const performances = await PerformanceModel.find({ run: id }).sort({ date: 1 })
      return connectionFromArray(performances, connArgs)
    } catch {
      return connectionFromArray([], connArgs)
    }
  }
}

export const upcomingPerformances: GraphQLFieldConfig<any, any, any> = {
  type: PerformanceConnection,
  args: {
    ...connectionArgs,
    city: {
      type: GraphQLString,
      description: 'Filter by city'
    }
  },
  resolve: async (_, args) => {
    const { city, ...connArgs } = args
    try {
      let filter: any = { date: { $gte: new Date() } }

      if (city) {
        const venues = await VenueModel.find({ city })
        const venueIds = venues.map(v => v._id)
        filter.venueId = { $in: venueIds }
      }

      const performances = await PerformanceModel.find(filter)
        .sort({ date: 1 })
        .limit(100)

      return connectionFromArray(performances, connArgs)
    } catch {
      return connectionFromArray([], connArgs)
    }
  }
}

export const performanceList: GraphQLFieldConfig<any, any, any> = {
  type: PerformanceConnection,
  args: {
    ...connectionArgs,
    search: {
      type: GraphQLString,
      description: 'Search by show title or venue name'
    }
  },
  resolve: async (_, args) => {
    const { search, ...connArgs } = args
    try {
      const limit = connArgs.first ?? 100
      const filter: any = {}

      if (search) {
        const regex = new RegExp(search, 'i')
        const matchingShows = await (await import('../../show/showModel')).ShowModel.find({ title: regex }).select('_id')
        const showIds = matchingShows.map(s => s._id)
        const matchingRuns = await RunModel.find({
          $or: [
            { title: regex },
            { show: { $in: showIds } }
          ]
        }).select('_id')
        const runIds = matchingRuns.map(r => r._id)

        const matchingVenues = await VenueModel.find({ name: regex }).select('_id')
        const venueIds = matchingVenues.map(v => v._id)

        filter.$or = [
          { run: { $in: runIds } },
          { venueId: { $in: venueIds } }
        ]
      }

      const performances = await PerformanceModel.find(filter).sort({ date: -1 }).limit(limit)
      return connectionFromArray(performances, connArgs)
    } catch {
      return connectionFromArray([], connArgs)
    }
  }
}

export const performanceQueries = {
  singlePerformance,
  performancesByRun,
  upcomingPerformances,
  performanceList
}
