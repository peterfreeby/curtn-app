import { GraphQLFieldConfig, GraphQLFieldConfigArgumentMap, GraphQLID, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLString } from 'graphql'
import { PerformanceConnection, performanceType } from '../performanceTypes'
import { PerformanceModel } from '../performanceModel'
import { connectionArgs, connectionFromArray, fromGlobalId } from 'graphql-relay'

// Get a single performance by ID
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
      const performance = await PerformanceModel.findById(id)
      return performance
    } catch (error) {
      return null
    }
  }
}

// List performances with filtering options
type PerformanceListArgs = GraphQLFieldConfigArgumentMap & {
    performanceTypes?: string[]
    city?: string
    venue?: string
    upcoming?: string
    search?: string
  }

export const performanceList: GraphQLFieldConfig<any, any, PerformanceListArgs> = {
  type: PerformanceConnection,
  args: {
    ...connectionArgs,
    performanceTypes: {
      type: new GraphQLList(GraphQLString),
      description: 'Filter by performance types (theater, musical, dance, etc.)'
    },
    city: {
      type: GraphQLString,
      description: 'Filter by city (NYC, Minneapolis, LA)'
    },
    venue: {
      type: GraphQLString,
      description: 'Filter by venue name'
    },
    upcoming: {
      type: GraphQLString, // Using string instead of boolean for simplicity
      description: 'Show only upcoming performances (true/false)'
    },
    search: {
      type: GraphQLString,
      description: 'Search by title or description'
    }
  },
  resolve: async (_, args) => {
    const { performanceTypes, city, venue, upcoming, search, ...connectionArgs } = args

    // Build filter object
    const filter: any = {}

    // Filter by performance types
    if (performanceTypes && performanceTypes.length > 0) {
      filter.performanceTypes = { $in: performanceTypes }
    }

    // Filter by city (search in venue addresses)
    if (city) {
      filter['venues.address'] = new RegExp(city, 'i')
    }

    // Filter by venue name
    if (venue) {
      filter['venues.name'] = new RegExp(venue, 'i')
    }

    // Filter by upcoming performances
    if (upcoming === 'true') {
      filter['performances.date'] = { $gte: new Date() }
    }

    // Text search in title and description
    if (search) {
      filter.$text = { $search: search }
    }

    try {
      const performances = await PerformanceModel.find(filter)
        .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
        .limit(100) // Reasonable limit

      return connectionFromArray(performances, connectionArgs)
    } catch (error) {
      console.error('Error fetching performances:', error)
      return connectionFromArray([], connectionArgs)
    }
  }
}

// Search performances by text
export const searchPerformances: GraphQLFieldConfig<any, any, { query: string }> = {
  type: PerformanceConnection,
  args: {
    ...connectionArgs,
    query: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Search query for title, description, or company name'
    }
  },
  resolve: async (_, args) => {
    const { query, ...connectionArgs } = args

    try {
      const performances = await PerformanceModel.find({
        $or: [
          { $text: { $search: query } },
          { 'company.name': new RegExp(query, 'i') }
        ]
      }).sort({ score: { $meta: 'textScore' } })

      return connectionFromArray(performances, connectionArgs)
    } catch (error) {
      console.error('Error searching performances:', error)
      return connectionFromArray([], connectionArgs)
    }
  }
}

// Get performances by venue (useful for venue pages)
export const performancesByVenue: GraphQLFieldConfig<any, any, { venueName: string }> = {
  type: PerformanceConnection,
  args: {
    ...connectionArgs,
    venueName: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Name of the venue'
    }
  },
  resolve: async (_, args) => {
    const { venueName, ...connectionArgs } = args

    try {
      const performances = await PerformanceModel.find({
        'venues.name': new RegExp(venueName, 'i')
      }).sort({ 'performances.date': -1 })

      return connectionFromArray(performances, connectionArgs)
    } catch (error) {
      console.error('Error fetching performances by venue:', error)
      return connectionFromArray([], connectionArgs)
    }
  }
}

// Export all queries
export const performanceQueries = {
  singlePerformance,
  performanceList,
  searchPerformances,
  performancesByVenue
}