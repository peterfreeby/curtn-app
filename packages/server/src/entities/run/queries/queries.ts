import { GraphQLFieldConfig, GraphQLID, GraphQLNonNull, GraphQLString } from 'graphql'
import { RunConnection, runType } from '../runTypes'
import { RunModel } from '../runModel'
import { ShowModel } from '../../show/showModel'
import { VenueModel } from '../../venue/venueModel'
import { connectionArgs, connectionFromArray, fromGlobalId } from 'graphql-relay'

export const singleRun: GraphQLFieldConfig<any, any, { id: string }> = {
  type: runType,
  args: {
    id: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Run ID'
    }
  },
  resolve: async (_, args) => {
    try {
      const { id } = fromGlobalId(args.id)
      return await RunModel.findById(id)
    } catch {
      return null
    }
  }
}

export const runsByShow: GraphQLFieldConfig<any, any, { showId: string }> = {
  type: RunConnection,
  args: {
    ...connectionArgs,
    showId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Show ID'
    }
  },
  resolve: async (_, args) => {
    const { showId, ...connArgs } = args
    try {
      const { id } = fromGlobalId(showId)
      const runs = await RunModel.find({ show: id }).sort({ startDate: -1 })
      return connectionFromArray(runs, connArgs)
    } catch {
      return connectionFromArray([], connArgs)
    }
  }
}

export const runsByVenue: GraphQLFieldConfig<any, any, { venueName: string }> = {
  type: RunConnection,
  args: {
    ...connectionArgs,
    venueName: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Venue name'
    }
  },
  resolve: async (_, args) => {
    const { venueName, ...connArgs } = args
    try {
      const venues = await VenueModel.find({ name: new RegExp(venueName, 'i') })
      const venueIds = venues.map(v => v._id)
      const runs = await RunModel.find({ venues: { $in: venueIds } }).sort({ startDate: -1 })
      return connectionFromArray(runs, connArgs)
    } catch {
      return connectionFromArray([], connArgs)
    }
  }
}

export const runList: GraphQLFieldConfig<any, any, any> = {
  type: RunConnection,
  args: {
    ...connectionArgs,
    search: {
      type: GraphQLString,
      description: 'Search by run title or show title'
    }
  },
  resolve: async (_, args) => {
    const { search, ...connArgs } = args
    try {
      const limit = connArgs.first ?? 100
      const filter: any = {}

      if (search) {
        const regex = new RegExp(search, 'i')
        const matchingShows = await ShowModel.find({ title: regex }).select('_id')
        const showIds = matchingShows.map(s => s._id)
        filter.$or = [
          { title: regex },
          { show: { $in: showIds } }
        ]
      }

      const runs = await RunModel.find(filter).sort({ createdAt: -1 }).limit(limit)
      return connectionFromArray(runs, connArgs)
    } catch {
      return connectionFromArray([], connArgs)
    }
  }
}

export const runQueries = {
  singleRun,
  runsByShow,
  runsByVenue,
  runList
}
