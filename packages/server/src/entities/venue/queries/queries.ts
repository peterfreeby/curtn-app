import { GraphQLFieldConfig, GraphQLID, GraphQLNonNull, GraphQLString, GraphQLFloat } from 'graphql'
import { VenueConnection, venueType } from '../venueTypes'
import { VenueModel } from '../venueModel'
import { connectionArgs, connectionFromArray, fromGlobalId } from 'graphql-relay'
import { applyCursorToQuery, buildConnection, connectionFromArrayLean } from '../../../graphql/cursorPagination'
import { buildBboxLocationFilter } from '../../../services/geo/bboxFilter'

// Get a single venue by ID
export const singleVenue: GraphQLFieldConfig<any, any, { id: string }> = {
  type: venueType,
  args: {
    id: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Venue ID'
    }
  },
  resolve: async (_, args) => {
    try {
      const { id } = fromGlobalId(args.id)
      const venue = await VenueModel.findById(id)
      return venue
    } catch (error) {
      return null
    }
  }
}

// Get venue by slug (for clean URLs)
export const venueBySlug: GraphQLFieldConfig<any, any, { slug: string }> = {
  type: venueType,
  args: {
    slug: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Venue slug (URL-friendly name)'
    }
  },
  resolve: async (_, args) => {
    try {
      const venue = await VenueModel.findOne({ slug: args.slug })
      return venue
    } catch (error) {
      return null
    }
  }
}

// List venues with filtering options
import { ConnectionArguments } from 'graphql-relay'

type VenueListArgs = ConnectionArguments & {
  city?: string
  venueType?: string
  search?: string
  swLat?: number
  swLng?: number
  neLat?: number
  neLng?: number
}

export const venueList: GraphQLFieldConfig<any, any, VenueListArgs> = {
  type: VenueConnection,
  args: {
    ...connectionArgs,
    city: {
      type: GraphQLString,
      description: 'Filter by city (NYC, Minneapolis, LA)'
    },
    venueType: {
      type: GraphQLString,
      description: 'Filter by venue type (theater, comedy-club, etc.)'
    },
    search: {
      type: GraphQLString,
      description: 'Search by name or description'
    },
    swLat: { type: GraphQLFloat, description: 'Bounding box south-west latitude' },
    swLng: { type: GraphQLFloat, description: 'Bounding box south-west longitude' },
    neLat: { type: GraphQLFloat, description: 'Bounding box north-east latitude' },
    neLng: { type: GraphQLFloat, description: 'Bounding box north-east longitude' },
  },
  resolve: async (_, args) => {
    const { city, venueType, search, swLat, swLng, neLat, neLng, ...connectionArgs } = args

    // Build filter object
    const filter: any = {}

    if (city) {
      filter.city = city
    }

    if (venueType) {
      filter.venueType = venueType
    }

    if (search) {
      filter.$text = { $search: search }
    }

    // Bbox filter — only when all four corners are provided and no text search
    // (MongoDB can't combine a text index and 2dsphere index in one query)
    // A world-ish / wrapped box yields null → no geo filter, so far-zoom returns
    // all venues (capped) to cluster instead of a blank map.
    const hasBbox = swLat != null && swLng != null && neLat != null && neLng != null
    if (hasBbox && !search) {
      const locationFilter = buildBboxLocationFilter(swLat!, swLng!, neLat!, neLng!)
      if (locationFilter) filter.location = locationFilter
    }

    const empty = { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } }
    try {
      if (search) {
        const limit = (connectionArgs as any).first ?? 100
        const venues = await VenueModel.find(filter)
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .lean()
        return connectionFromArrayLean(venues, connectionArgs)
      }

      const geoMaxLimit = hasBbox ? 500 : undefined
      const { filter: cursorFilter, sort, limit } = applyCursorToQuery(filter, {
        after: (connectionArgs as any).after,
        first: (connectionArgs as any).first,
        sortField: 'name',
        sortDirection: 1,
        maxLimit: geoMaxLimit
      })
      const venues = await VenueModel.find(cursorFilter).sort(sort).limit(limit).lean()
      return buildConnection(venues, { first: (connectionArgs as any).first, sortField: 'name', maxLimit: geoMaxLimit })
    } catch (error) {
      console.error('Error fetching venues:', error)
      return empty
    }
  }
}

// Search venues by location (near coordinates)
type VenuesNearArgs = ConnectionArguments & {
  latitude: number
  longitude: number
  maxDistance?: number
}

export const venuesNear: GraphQLFieldConfig<any, any, VenuesNearArgs> = {
  type: VenueConnection,
  args: {
    ...connectionArgs,
    latitude: {
      type: new GraphQLNonNull(GraphQLFloat),
      description: 'Latitude to search near'
    },
    longitude: {
      type: new GraphQLNonNull(GraphQLFloat),
      description: 'Longitude to search near'
    },
    maxDistance: {
      type: GraphQLFloat,
      description: 'Maximum distance in meters (default: 10000 = ~6 miles)'
    }
  },
  resolve: async (_, args) => {
    const { latitude, longitude, maxDistance = 10000, ...connectionArgs } = args

    try {
      const venues = await VenueModel.find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude] // GeoJSON: [lng, lat]
            },
            $maxDistance: maxDistance
          }
        }
      }).limit(50).lean()

      return connectionFromArrayLean(venues, connectionArgs)
    } catch (error) {
      console.error('Error finding venues near location:', error)
      return connectionFromArray([], connectionArgs)
    }
  }
}

// Get venues by city (useful for city pages)
export const venuesByCity: GraphQLFieldConfig<any, any, { city: string }> = {
  type: VenueConnection,
  args: {
    ...connectionArgs,
    city: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'City name (NYC, Minneapolis, LA)'
    }
  },
  resolve: async (_, args) => {
    const { city, ...connectionArgs } = args

    try {
      const { filter, sort, limit } = applyCursorToQuery({ city }, {
        after: (connectionArgs as any).after,
        first: (connectionArgs as any).first,
        sortField: 'name',
        sortDirection: 1,
        maxLimit: 200
      })
      const venues = await VenueModel.find(filter).sort(sort).limit(limit).lean()
      return buildConnection(venues, { first: (connectionArgs as any).first, sortField: 'name', maxLimit: 200 })
    } catch (error) {
      console.error('Error fetching venues by city:', error)
      return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } }
    }
  }
}

// Export all venue queries
export const venueQueries = {
  singleVenue,
  venueBySlug,
  venueList,
  venuesNear,
  venuesByCity
}