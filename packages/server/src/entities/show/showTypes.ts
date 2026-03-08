import {
  GraphQLList,
  GraphQLFloat,
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLBoolean
} from 'graphql'
import { nodeInterface } from '../../graphql/nodeInterface'
import { globalIdField, connectionDefinitions } from 'graphql-relay'
import { entityRegister } from '../../graphql/entityHelpers'
import { ShowModel } from './showModel'
import { RunModel } from '../run/runModel'
import { ReviewModel } from '../review/reviewModel'

export const showType: GraphQLObjectType = new GraphQLObjectType({
  name: 'Show',
  description: 'An intellectual work (e.g. "Hamilton", "Rejected Shorts")',
  interfaces: () => [nodeInterface],
  fields: () => {
    const { RunConnection } = require('../run/runTypes')
    return {
      id: globalIdField('Show', show => show.id),
      title: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: show => show.title
      },
      description: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: show => show.description
      },
      performanceTypes: {
        type: new GraphQLNonNull(new GraphQLList(GraphQLString)),
        resolve: show => show.performanceTypes
      },
      duration: {
        type: new GraphQLNonNull(GraphQLInt),
        resolve: show => show.duration
      },
      languages: {
        type: new GraphQLList(GraphQLString),
        resolve: show => show.languages
      },
      url: {
        type: GraphQLString,
        resolve: show => show.url
      },
      imageUrl: {
        type: GraphQLString,
        resolve: show => show.imageUrl
      },
      wikidataId: {
        type: GraphQLString,
        resolve: show => show.wikidataId
      },
      runs: {
        type: RunConnection,
        description: 'All production runs of this show',
        resolve: async show => {
          const runs = await RunModel.find({ show: show._id }).sort({ startDate: -1 })
          return { edges: runs.map(r => ({ node: r, cursor: r._id.toString() })), pageInfo: { hasNextPage: false, hasPreviousPage: false } }
        }
      },
      averageRating: {
        type: GraphQLFloat,
        resolve: async show => {
          const { PerformanceModel } = require('../performance/performanceModel')
          const runs = await RunModel.find({ show: show._id }, '_id')
          if (runs.length === 0) return null
          const runIds = runs.map(r => r._id)
          const performances = await PerformanceModel.find({ run: { $in: runIds } }, '_id')
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
        resolve: async show => {
          const { PerformanceModel } = require('../performance/performanceModel')
          const runs = await RunModel.find({ show: show._id }, '_id')
          const runIds = runs.map(r => r._id)
          const performances = await PerformanceModel.find({ run: { $in: runIds } }, '_id')
          const perfIds = performances.map((p: any) => p._id)
          return await ReviewModel.countDocuments({ performance: { $in: perfIds } })
        }
      },
      watchlistCount: {
        type: GraphQLInt,
        resolve: async (show) => {
          const { WatchlistItemModel } = require('../watchlist/watchlistModel')
          return await WatchlistItemModel.countDocuments({ show: show._id })
        }
      },
      isOnMyWatchlist: {
        type: GraphQLBoolean,
        resolve: async (show, _args, ctx) => {
          if (!ctx.user) return false
          const { WatchlistItemModel } = require('../watchlist/watchlistModel')
          const item = await WatchlistItemModel.findOne({ user: ctx.user.id, show: show._id })
          return !!item
        }
      },
      creators: {
        type: require('../showCredit/showCreditTypes').ShowCreditConnection,
        description: 'Show-level credits (playwrights, composers, etc.)',
        resolve: async (show: any) => {
          const { ShowCreditModel } = require('../showCredit/showCreditModel')
          const showCredits = await ShowCreditModel.find({ show: show._id }).sort({ order: 1 })
          return {
            edges: showCredits.map((sc: any) => ({ node: sc, cursor: sc._id.toString() })),
            pageInfo: { hasNextPage: false, hasPreviousPage: false }
          }
        }
      },
      source: {
        type: require('../dataSource/dataSourceTypes').dataSourceType,
        resolve: async (show: any) => {
          if (!show.source) return null
          const { DataSourceModel } = require('../dataSource/dataSourceModel')
          return DataSourceModel.findById(show.source)
        }
      },
      createdAt: {
        type: GraphQLString,
        resolve: show => show.createdAt?.toISOString()
      },
      updatedAt: {
        type: GraphQLString,
        resolve: show => show.updatedAt?.toISOString()
      }
    }
  }
})

export const { connectionType: ShowConnection, edgeType: ShowEdge } = connectionDefinitions({
  nodeType: showType
})

entityRegister({
  type: showType,
  nodeResolver: async (id) => await ShowModel.findById(id)
})
