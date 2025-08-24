import {
    GraphQLList,
    GraphQLFloat,
    GraphQLString,
    GraphQLNonNull,
    GraphQLObjectType,
    GraphQLInt,
    GraphQLInputObjectType
  } from 'graphql'
  import { nodeInterface } from '../../graphql/nodeInterface'
  import { globalIdField, connectionDefinitions } from 'graphql-relay'
  import { entityRegister } from '../../graphql/entityHelpers'
  import { PerformanceModel } from './performanceModel'
  import { VenueModel } from '../venue/venueModel'
  import { ReviewModel } from '../review/reviewModel'
  import { venueType } from '../venue/venueTypes'
  
  // Company/Troupe type
  const companyType = new GraphQLObjectType({
    name: 'Company',
    fields: () => ({
      name: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: company => company.name
      },
      description: {
        type: GraphQLString,
        resolve: company => company.description
      },
      wikidataId: {
        type: GraphQLString,
        resolve: company => company.wikidataId
      }
    })
  })
  
  // Individual performance showing type
  const showingType = new GraphQLObjectType({
    name: 'Showing',
    fields: () => ({
      date: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: showing => showing.date.toISOString()
      },
      time: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: showing => showing.time
      },
      venue: {
        type: venueType,
        resolve: async showing => {
          // Fetch the venue document for this showing
          const venue = await VenueModel.findById(showing.venueId)
          return venue
        }
      },
      ticketUrl: {
        type: GraphQLString,
        resolve: showing => showing.ticketUrl
      },
      eventbriteId: {
        type: GraphQLString,
        resolve: showing => showing.eventbriteId
      },
      soldOut: {
        type: GraphQLString, // Using string to avoid importing GraphQLBoolean
        resolve: showing => showing.soldOut ? 'true' : 'false'
      }
    })
  })
  
  // Main Performance type
  export const performanceType = new GraphQLObjectType({
    name: 'Performance',
    description: 'Performance type for theater, dance, and other live arts',
    interfaces: () => [nodeInterface],
    fields: () => ({
      id: globalIdField('Performance', performance => performance.id),
      title: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'Performance title',
        resolve: performance => performance.title
      },
      description: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'Performance description',
        resolve: performance => performance.description
      },
      performanceTypes: {
        type: new GraphQLNonNull(new GraphQLList(GraphQLString)),
        description: 'Types/genres of this performance',
        resolve: performance => performance.performanceTypes
      },
      duration: {
        type: new GraphQLNonNull(GraphQLInt),
        description: 'Duration in minutes',
        resolve: performance => performance.duration
      },
      intermissions: {
        type: GraphQLInt,
        description: 'Number of intermissions',
        resolve: performance => performance.intermissions
      },
      language: {
        type: new GraphQLList(GraphQLString),
        description: 'Languages used in the performance',
        resolve: performance => performance.language
      },
      venues: {
        type: new GraphQLNonNull(new GraphQLList(venueType)),
        description: 'Venues where this performance is/was shown',
        resolve: async performance => {
          // Fetch venue documents from the venue collection
          const venues = await VenueModel.find({ _id: { $in: performance.venues } })
          return venues
        }
      },
      company: {
        type: new GraphQLNonNull(companyType),
        description: 'Company or troupe performing',
        resolve: performance => performance.company
      },
      performances: {
        type: new GraphQLNonNull(new GraphQLList(showingType)),
        description: 'Scheduled performances/showings',
        resolve: performance => performance.performances
      },
      upcomingPerformances: {
        type: new GraphQLList(showingType),
        description: 'Future performances only',
        resolve: performance => {
          const now = new Date()
          return performance.performances.filter((p: any) => new Date(p.date) > now)
        }
      },
      averageRating: {
        type: GraphQLFloat,
        description: 'Average rating from all reviews',
        resolve: async performance => {
          const reviews = await ReviewModel.find({ performance: performance._id })
          if (reviews.length === 0) return null
          
          const sum = reviews.reduce((acc, review) => acc + review.rating, 0)
          return Math.round((sum / reviews.length) * 10) / 10 // Round to 1 decimal
        }
      },
      reviewCount: {
        type: GraphQLInt,
        description: 'Total number of reviews',
        resolve: async performance => {
          return await ReviewModel.countDocuments({ performance: performance._id })
        }
      },
      wikidataId: {
        type: GraphQLString,
        resolve: performance => performance.wikidataId
      },
      eventbriteId: {
        type: GraphQLString,
        resolve: performance => performance.eventbriteId
      },
      createdAt: {
        type: GraphQLString,
        resolve: performance => performance.createdAt?.toISOString()
      },
      updatedAt: {
        type: GraphQLString,
        resolve: performance => performance.updatedAt?.toISOString()
      }
    })
  })
  
  // Input types for creating/updating performances
  export const performanceInputType = {
    title: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Performance title'
    },
    description: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Performance description'
    },
    performanceTypes: {
      type: new GraphQLNonNull(new GraphQLList(GraphQLString)),
      description: 'Performance types/genres'
    },
    duration: {
      type: new GraphQLNonNull(GraphQLInt),
      description: 'Duration in minutes'
    },
    intermissions: {
      type: GraphQLInt,
      description: 'Number of intermissions'
    },
    language: {
      type: new GraphQLList(GraphQLString),
      description: 'Languages used'
    },
    companyName: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Name of performing company/troupe'
    },
    companyDescription: {
      type: GraphQLString,
      description: 'Description of the company'
    },
    wikidataId: {
      type: GraphQLString,
      description: 'Wikidata identifier'
    },
    eventbriteId: {
      type: GraphQLString,
      description: 'Eventbrite event identifier'
    }
  }
  
  // Connection types for pagination
  export const { connectionType: PerformanceConnection, edgeType: PerformanceEdge } = connectionDefinitions({
    nodeType: performanceType
  })
  
  // Register with the node interface system
  entityRegister({
    type: performanceType,
    nodeResolver: async (id) => await PerformanceModel.findById(id)
  })