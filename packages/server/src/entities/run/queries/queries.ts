import { GraphQLFieldConfig, GraphQLID, GraphQLNonNull, GraphQLString } from 'graphql'
import { RunConnection, runType } from '../runTypes'
import { RunModel } from '../runModel'
import { ShowModel } from '../../show/showModel'
import { VenueModel } from '../../venue/venueModel'
import { connectionArgs, connectionFromArray, fromGlobalId } from 'graphql-relay'
import { applyCursorToQuery, buildConnection } from '../../../graphql/cursorPagination'

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
    const empty = { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } }
    try {
      const { id } = fromGlobalId(showId)
      const { filter, sort, limit } = applyCursorToQuery({ show: id }, {
        after: (connArgs as any).after,
        first: (connArgs as any).first,
        sortField: 'startDate',
        sortDirection: -1,
        maxLimit: 200
      })
      const runs = await RunModel.find(filter).sort(sort).limit(limit).lean()
      return buildConnection(runs, { first: (connArgs as any).first, sortField: 'startDate', maxLimit: 200 })
    } catch {
      return empty
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
    const empty = { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } }
    try {
      const venues = await VenueModel.find({ name: new RegExp(venueName, 'i') })
      const venueIds = venues.map(v => v._id)
      const { filter, sort, limit } = applyCursorToQuery({ venues: { $in: venueIds } }, {
        after: (connArgs as any).after,
        first: (connArgs as any).first,
        sortField: 'startDate',
        sortDirection: -1,
        maxLimit: 200
      })
      const runs = await RunModel.find(filter).sort(sort).limit(limit).lean()
      return buildConnection(runs, { first: (connArgs as any).first, sortField: 'startDate', maxLimit: 200 })
    } catch {
      return empty
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
    const empty = { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } }
    try {
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

      const { filter: cursorFilter, sort, limit } = applyCursorToQuery(filter, {
        after: (connArgs as any).after,
        first: (connArgs as any).first,
        sortField: 'createdAt',
        sortDirection: -1
      })
      const runs = await RunModel.find(cursorFilter).sort(sort).limit(limit).lean()
      return buildConnection(runs, { first: (connArgs as any).first, sortField: 'createdAt' })
    } catch {
      return empty
    }
  }
}

export const runQueries = {
  singleRun,
  runsByShow,
  runsByVenue,
  runList
}
