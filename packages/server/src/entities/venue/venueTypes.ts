import {
    GraphQLList,
    GraphQLFloat,
    GraphQLString,
    GraphQLNonNull,
    GraphQLObjectType,
    GraphQLInt,
    ThunkObjMap,
    GraphQLInputFieldConfig
  } from 'graphql'
  import { nodeInterface } from '../../graphql/nodeInterface'
  import { globalIdField, connectionDefinitions } from 'graphql-relay'
  import { entityRegister } from '../../graphql/entityHelpers'
  import { VenueModel } from './venueModel'
  
  // Coordinates type for venue location
  const coordinatesType = new GraphQLObjectType({
    name: 'Coordinates',
    fields: {
      lat: {
        type: new GraphQLNonNull(GraphQLFloat),
        description: 'Latitude',
        resolve: coords => coords.lat
      },
      lng: {
        type: new GraphQLNonNull(GraphQLFloat),
        description: 'Longitude', 
        resolve: coords => coords.lng
      }
    }
  })
  
  // Main Venue type
  export const venueType = new GraphQLObjectType({
    name: 'Venue',
    description: 'Performance venue (theater, comedy club, etc.)',
    interfaces: () => [nodeInterface],
    fields: () => ({
      id: globalIdField('Venue', venue => venue.id),
      name: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'Venue name',
        resolve: venue => venue.name
      },
      slug: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'URL-friendly venue name',
        resolve: venue => venue.slug
      },
      description: {
        type: GraphQLString,
        description: 'Venue description',
        resolve: venue => venue.description
      },
      address: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'Street address',
        resolve: venue => venue.address
      },
      city: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'City (NYC, Minneapolis, LA)',
        resolve: venue => venue.city
      },
      state: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'State abbreviation (NY, MN, CA)',
        resolve: venue => venue.state
      },
      zipCode: {
        type: GraphQLString,
        description: 'ZIP/postal code',
        resolve: venue => venue.zipCode
      },
      coordinates: {
        type: new GraphQLNonNull(coordinatesType),
        description: 'Geographic coordinates',
        resolve: venue => venue.coordinates
      },
      capacity: {
        type: GraphQLInt,
        description: 'Seating capacity',
        resolve: venue => venue.capacity
      },
      venueType: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'Type of venue (theater, comedy-club, etc.)',
        resolve: venue => venue.venueType
      },
      website: {
        type: GraphQLString,
        description: 'Venue website URL',
        resolve: venue => venue.website
      },
      phone: {
        type: GraphQLString,
        description: 'Phone number',
        resolve: venue => venue.phone
      },
      email: {
        type: GraphQLString,
        description: 'Contact email',
        resolve: venue => venue.email
      },
      eventbriteVenueId: {
        type: GraphQLString,
        description: 'Eventbrite venue identifier',
        resolve: venue => venue.eventbriteVenueId
      },
      googlePlaceId: {
        type: GraphQLString,
        description: 'Google Places identifier',
        resolve: venue => venue.googlePlaceId
      },
      createdAt: {
        type: GraphQLString,
        description: 'When venue was added',
        resolve: venue => venue.createdAt?.toISOString()
      },
      updatedAt: {
        type: GraphQLString,
        description: 'When venue was last updated',
        resolve: venue => venue.updatedAt?.toISOString()
      }
    })
  })
  
  // Input type for creating/updating venues
  export const venueInputType: ThunkObjMap<GraphQLInputFieldConfig> = {
    name: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Venue name'
    },
    description: {
      type: GraphQLString,
      description: 'Venue description'
    },
    address: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Street address'
    },
    city: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'City (NYC, Minneapolis, or LA)'
    },
    state: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'State (NY, MN, or CA)'
    },
    zipCode: {
      type: GraphQLString,
      description: 'ZIP code'
    },
    latitude: {
      type: new GraphQLNonNull(GraphQLFloat),
      description: 'Latitude coordinate'
    },
    longitude: {
      type: new GraphQLNonNull(GraphQLFloat),
      description: 'Longitude coordinate'
    },
    capacity: {
      type: GraphQLInt,
      description: 'Seating capacity'
    },
    venueType: {
      type: GraphQLString,
      description: 'Venue type (theater, comedy-club, etc.)'
    },
    website: {
      type: GraphQLString,
      description: 'Website URL'
    },
    phone: {
      type: GraphQLString,
      description: 'Phone number'
    },
    email: {
      type: GraphQLString,
      description: 'Contact email'
    },
    eventbriteVenueId: {
      type: GraphQLString,
      description: 'Eventbrite venue ID'
    },
    googlePlaceId: {
      type: GraphQLString,
      description: 'Google Places ID'
    }
  }
  
  // Connection types for pagination
  export const { connectionType: VenueConnection, edgeType: VenueEdge } = connectionDefinitions({
    nodeType: venueType
  })
  
  // Register with the node interface system
  entityRegister({
    type: venueType,
    nodeResolver: async (id) => await VenueModel.findById(id)
  })