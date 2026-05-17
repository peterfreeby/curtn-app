import { GraphQLFieldConfig, GraphQLFloat, GraphQLID, GraphQLNonNull, GraphQLString } from 'graphql'
import { PerformanceConnection, performanceType } from '../performanceTypes'
import { PerformanceModel } from '../performanceModel'
import { RunModel } from '../../run/runModel'
import { VenueModel } from '../../venue/venueModel'
import { connectionArgs, connectionFromArray, fromGlobalId } from 'graphql-relay'
import { applyCursorToQuery, buildConnection } from '../../../graphql/cursorPagination'

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
    const empty = { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } }
    try {
      const { id } = fromGlobalId(runId)
      const { filter, sort, limit } = applyCursorToQuery({ run: id }, {
        after: (connArgs as any).after,
        first: (connArgs as any).first,
        sortField: 'date',
        sortDirection: 1,
        maxLimit: 500
      })
      const performances = await PerformanceModel.find(filter).sort(sort).limit(limit).lean()
      return buildConnection(performances, { first: (connArgs as any).first, sortField: 'date', maxLimit: 500 })
    } catch {
      return empty
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
    const empty = { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } }
    try {
      let baseFilter: any = { date: { $gte: new Date() } }

      if (city) {
        const venues = await VenueModel.find({ city })
        const venueIds = venues.map(v => v._id)
        baseFilter.venueId = { $in: venueIds }
      }

      const { filter, sort, limit } = applyCursorToQuery(baseFilter, {
        after: (connArgs as any).after,
        first: (connArgs as any).first,
        sortField: 'date',
        sortDirection: 1
      })
      const performances = await PerformanceModel.find(filter).sort(sort).limit(limit).lean()
      return buildConnection(performances, { first: (connArgs as any).first, sortField: 'date' })
    } catch {
      return empty
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
    },
    swLat: { type: GraphQLFloat, description: 'Bounding box south-west latitude' },
    swLng: { type: GraphQLFloat, description: 'Bounding box south-west longitude' },
    neLat: { type: GraphQLFloat, description: 'Bounding box north-east latitude' },
    neLng: { type: GraphQLFloat, description: 'Bounding box north-east longitude' },
    startDate: { type: GraphQLString, description: 'Filter performances on or after this ISO date' },
    endDate: { type: GraphQLString, description: 'Filter performances before this ISO date' },
  },
  resolve: async (_, args) => {
    const { search, swLat, swLng, neLat, neLng, startDate, endDate, ...connArgs } = args
    const empty = { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } }
    try {
      const baseFilter: any = {}

      if (startDate) baseFilter.date = { ...baseFilter.date, $gte: new Date(startDate) }
      if (endDate) baseFilter.date = { ...baseFilter.date, $lt: new Date(endDate) }

      // Bbox filter — only when all four corners provided and no text search active
      const hasBbox = swLat != null && swLng != null && neLat != null && neLng != null
      if (hasBbox && !search) {
        const venueIds = await VenueModel.find({
          location: {
            $geoWithin: {
              $geometry: {
                type: 'Polygon',
                coordinates: [[[swLng, swLat], [neLng, swLat], [neLng, neLat], [swLng, neLat], [swLng, swLat]]]
              }
            }
          }
        }).distinct('_id')
        baseFilter.venueId = { $in: venueIds }
      }

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

        baseFilter.$or = [
          { run: { $in: runIds } },
          { venueId: { $in: venueIds } }
        ]
      }

      const geoMaxLimit = hasBbox ? 500 : undefined
      const { filter, sort, limit } = applyCursorToQuery(baseFilter, {
        after: (connArgs as any).after,
        first: (connArgs as any).first,
        sortField: 'date',
        sortDirection: -1,
        maxLimit: geoMaxLimit
      })
      const performances = await PerformanceModel.find(filter).sort(sort).limit(limit).lean()
      return buildConnection(performances, { first: (connArgs as any).first, sortField: 'date', maxLimit: geoMaxLimit })
    } catch {
      return empty
    }
  }
}

export const performanceQueries = {
  singlePerformance,
  performancesByRun,
  upcomingPerformances,
  performanceList
}
