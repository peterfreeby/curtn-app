import { GraphQLFieldConfig, GraphQLFieldConfigArgumentMap, GraphQLID, GraphQLNonNull, GraphQLString, GraphQLFloat } from 'graphql'
import { VenueConnection, venueType } from '../venueTypes'
import { VenueModel } from '../venueModel'
import { connectionArgs, connectionFromArray, fromGlobalId } from 'graphql-relay'

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
type VenueListArgs = GraphQLFieldConfigArgumentMap & {
  city?: string
  venueType?: string
  search?: string
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
    }
  },
  resolve: async (_, args) => {
    const { city, venueType, search, ...connectionArgs } = args

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

    try {
      const venues = await VenueModel.find(filter)
        .sort(search ? { score: { $meta: 'textScore' } } : { name: 1 })
        .limit(100)

      return connectionFromArray(venues, connectionArgs)
    } catch (error) {
      console.error('Error fetching venues:', error)
      return connectionFromArray([], connectionArgs)
    }
  }
}

// Search venues by location (near coordinates)
type VenuesNearArgs = GraphQLFieldConfigArgumentMap & {
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
        coordinates: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude] // Note: MongoDB uses [lng, lat]
            },
            $maxDistance: maxDistance
          }
        }
      }).limit(50)

      return connectionFromArray(venues, connectionArgs)
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
      const venues = await VenueModel.find({ city })
        .sort({ name: 1 })

      return connectionFromArray(venues, connectionArgs)
    } catch (error) {
      console.error('Error fetching venues by city:', error)
      return connectionFromArray([], connectionArgs)
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