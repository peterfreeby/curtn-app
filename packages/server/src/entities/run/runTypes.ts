import {
  GraphQLList,
  GraphQLFloat,
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInt
} from 'graphql'
import { nodeInterface } from '../../graphql/nodeInterface'
import { globalIdField, connectionDefinitions } from 'graphql-relay'
import { entityRegister } from '../../graphql/entityHelpers'
import { RunModel } from './runModel'
import { ShowModel } from '../show/showModel'
import { ProductionCompanyModel } from '../productionCompany/productionCompanyModel'
import { VenueModel } from '../venue/venueModel'
import { CreditModel } from '../credit/creditModel'
import { ReviewModel } from '../review/reviewModel'
import { venueType } from '../venue/venueTypes'
import { showType } from '../show/showTypes'
import { productionCompanyType } from '../productionCompany/productionCompanyTypes'

export const runType: GraphQLObjectType = new GraphQLObjectType({
  name: 'Run',
  description: 'A specific production of a Show by a Company at a Venue during a time window',
  interfaces: () => [nodeInterface],
  fields: () => {
    const { PerformanceConnection } = require('../performance/performanceTypes')
    const { PerformanceModel } = require('../performance/performanceModel')
    const { creditType } = require('../credit/creditType')
    return {
      id: globalIdField('Run', run => run.id),
      title: {
        type: GraphQLString,
        description: 'Run-specific title (e.g. "Inwood Shakespeare Festival\'s Annual: King Lear")',
        resolve: run => run.title
      },
      effectiveTitle: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'Run title if set, otherwise falls back to show title',
        resolve: async run => {
          if (run.title) return run.title
          const show = await ShowModel.findById(run.show)
          return show?.title || 'Untitled'
        }
      },
      show: {
        type: new GraphQLNonNull(showType),
        resolve: async run => await ShowModel.findById(run.show)
      },
      productionCompany: {
        type: productionCompanyType,
        resolve: async run => run.productionCompany ? await ProductionCompanyModel.findById(run.productionCompany) : null
      },
      venues: {
        type: new GraphQLNonNull(new GraphQLList(venueType)),
        resolve: async run => await VenueModel.find({ _id: { $in: run.venues } })
      },
      stage: {
        type: require('../stage/stageTypes').stageType,
        resolve: async (run: any) => {
          if (!run.stage) return null
          const { StageModel } = require('../stage/stageModel')
          return StageModel.findById(run.stage)
        }
      },
      intermissions: {
        type: GraphQLInt,
        resolve: run => run.intermissions
      },
      startDate: {
        type: GraphQLString,
        resolve: run => run.startDate?.toISOString()
      },
      endDate: {
        type: GraphQLString,
        resolve: run => run.endDate?.toISOString()
      },
      description: {
        type: GraphQLString,
        resolve: run => run.description
      },
      imageUrl: {
        type: GraphQLString,
        resolve: run => run.imageUrl
      },
      posterUrl: {
        type: GraphQLString,
        resolve: run => run.posterUrl
      },
      wikidataId: {
        type: GraphQLString,
        resolve: run => run.wikidataId
      },
      eventbriteId: {
        type: GraphQLString,
        resolve: run => run.eventbriteId
      },
      verificationStatus: {
        type: GraphQLString,
        resolve: run => run.verificationStatus
      },
      performances: {
        type: PerformanceConnection,
        description: 'All showings in this run',
        resolve: async run => {
          const performances = await PerformanceModel.find({ run: run._id }).sort({ date: 1 })
          return { edges: performances.map((p: any) => ({ node: p, cursor: p._id.toString() })), pageInfo: { hasNextPage: false, hasPreviousPage: false } }
        }
      },
      upcomingPerformances: {
        type: PerformanceConnection,
        description: 'Future showings only',
        resolve: async run => {
          const performances = await PerformanceModel.find({ run: run._id, date: { $gte: new Date() } }).sort({ date: 1 })
          return { edges: performances.map((p: any) => ({ node: p, cursor: p._id.toString() })), pageInfo: { hasNextPage: false, hasPreviousPage: false } }
        }
      },
      cast: {
        type: new GraphQLList(creditType),
        resolve: async run => await CreditModel.find({ run: run._id, creditType: 'cast' }).sort({ order: 1 })
      },
      crew: {
        type: new GraphQLList(creditType),
        resolve: async run => await CreditModel.find({ run: run._id, creditType: 'crew' }).sort({ order: 1 })
      },
      averageRating: {
        type: GraphQLFloat,
        resolve: async run => {
          const performances = await PerformanceModel.find({ run: run._id }, '_id')
          if (performances.length === 0) return null
          const perfIds = performances.map((p: any) => p._id)
          const reviews = await ReviewModel.find({ performance: { $in: perfIds } })
          if (reviews.length === 0) return null
          const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
          return Math.round((sum / reviews.length) * 10) / 10
        }
      },
      reviewCount: {
        type: GraphQLInt,
        resolve: async run => {
          const performances = await PerformanceModel.find({ run: run._id }, '_id')
          const perfIds = performances.map((p: any) => p._id)
          return await ReviewModel.countDocuments({ performance: { $in: perfIds } })
        }
      },
      createdAt: {
        type: GraphQLString,
        resolve: run => run.createdAt?.toISOString()
      },
      updatedAt: {
        type: GraphQLString,
        resolve: run => run.updatedAt?.toISOString()
      }
    }
  }
})

export const { connectionType: RunConnection, edgeType: RunEdge } = connectionDefinitions({
  nodeType: runType
})

entityRegister({
  type: runType,
  nodeResolver: async (id) => await RunModel.findById(id)
})
