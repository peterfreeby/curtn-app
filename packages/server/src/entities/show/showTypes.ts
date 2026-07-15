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
import { globalIdField, connectionDefinitions, connectionArgs } from 'graphql-relay'
import { applyCursorToQuery, buildConnection } from '../../graphql/cursorPagination'
import { entityRegister } from '../../graphql/entityHelpers'
import { ShowModel } from './showModel'
import { RunModel } from '../run/runModel'
import { ReviewModel } from '../review/reviewModel'
import { SeenModel } from '../seen/seenModel'

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
      posterUrl: {
        type: GraphQLString,
        resolve: show => show.posterUrl
      },
      wikidataId: {
        type: GraphQLString,
        resolve: show => show.wikidataId
      },
      verificationStatus: {
        type: GraphQLString,
        resolve: show => show.verificationStatus
      },
      runs: {
        type: RunConnection,
        description: 'All production runs of this show',
        args: { ...connectionArgs },
        resolve: async (show: any, args: any, ctx: any) => {
          // If no pagination args, use DataLoader for batching
          if (!args.first && !args.after && ctx.loaders) {
            const runs = await ctx.loaders.runsByShowLoader.load(show._id.toString())
            return { edges: runs.map((r: any) => ({ node: r, cursor: r._id.toString() })), pageInfo: { hasNextPage: false, hasPreviousPage: false } }
          }
          const { filter, sort, limit } = applyCursorToQuery({ show: show._id }, {
            after: args.after, first: args.first, sortField: 'startDate', sortDirection: -1, maxLimit: 200
          })
          const runs = await RunModel.find(filter).sort(sort).limit(limit).lean()
          return buildConnection(runs, { first: args.first, sortField: 'startDate', maxLimit: 200 })
        }
      },
      averageRating: {
        type: GraphQLFloat,
        resolve: async (show: any, _args: any, ctx: any) => {
          const { PerformanceModel } = require('../performance/performanceModel')
          const runs = ctx.loaders
            ? await ctx.loaders.runsByShowLoader.load(show._id.toString())
            : await RunModel.find({ show: show._id }, '_id')
          if (runs.length === 0) return null
          const runIds = runs.map((r: any) => r._id)
          const performances = await PerformanceModel.find({ run: { $in: runIds } }, '_id')
          if (performances.length === 0) return null
          const perfIds = performances.map((p: any) => p._id)
          const reviews = await ReviewModel.find({ performance: { $in: perfIds } })
          if (reviews.length === 0) return null
          const sum = reviews.reduce((acc: number, r: any) => acc + r.rating, 0)
          return Math.round((sum / reviews.length) * 10) / 10
        }
      },
      reviewCount: {
        type: GraphQLInt,
        resolve: async (show: any, _args: any, ctx: any) => {
          const { PerformanceModel } = require('../performance/performanceModel')
          const runs = ctx.loaders
            ? await ctx.loaders.runsByShowLoader.load(show._id.toString())
            : await RunModel.find({ show: show._id }, '_id')
          const runIds = runs.map((r: any) => r._id)
          const performances = await PerformanceModel.find({ run: { $in: runIds } }, '_id')
          const perfIds = performances.map((p: any) => p._id)
          return await ReviewModel.countDocuments({ performance: { $in: perfIds } })
        }
      },
      watchlistCount: {
        type: GraphQLInt,
        resolve: async (show: any, _args: any, ctx: any) => {
          if (ctx.loaders) return ctx.loaders.watchlistCountByShowLoader.load(show._id.toString())
          const { WatchlistItemModel } = require('../watchlist/watchlistModel')
          return WatchlistItemModel.countDocuments({ show: show._id })
        }
      },
      isOnMyWatchlist: {
        type: GraphQLBoolean,
        resolve: async (show: any, _args: any, ctx: any) => {
          if (!ctx.user) return false
          const { WatchlistItemModel } = require('../watchlist/watchlistModel')
          const item = await WatchlistItemModel.findOne({ user: ctx.user.id, show: show._id })
          return !!item
        }
      },
      viewerHasSeen: {
        type: GraphQLBoolean,
        description: 'Whether the current viewer has seen any run of this show',
        resolve: async (show: any, _args: any, ctx: any) => {
          if (!ctx.user) return false
          const seen = await SeenModel.findOne({ user: ctx.user.id, show: show._id })
          if (seen) return true
          const runs = await RunModel.find({ show: show._id }, '_id')
          if (runs.length === 0) return false
          const runIds = runs.map((r: any) => r._id)
          const review = await ReviewModel.findOne({ user: ctx.user.id, run: { $in: runIds } })
          return !!review
        }
      },
      creators: {
        type: require('../showCredit/showCreditTypes').ShowCreditConnection,
        description: 'Show-level credits (playwrights, composers, etc.)',
        args: { ...connectionArgs },
        resolve: async (show: any, args: any, ctx: any) => {
          // If no pagination args, use DataLoader for batching
          if (!args.first && !args.after && ctx.loaders) {
            const showCredits = await ctx.loaders.showCreditsByShowLoader.load(show._id.toString())
            return {
              edges: showCredits.map((sc: any) => ({ node: sc, cursor: sc._id.toString() })),
              pageInfo: { hasNextPage: false, hasPreviousPage: false }
            }
          }
          const { ShowCreditModel } = require('../showCredit/showCreditModel')
          const { filter, sort, limit } = applyCursorToQuery({ show: show._id }, {
            after: args.after, first: args.first, sortField: 'order', sortDirection: 1, maxLimit: 100
          })
          const showCredits = await ShowCreditModel.find(filter).sort(sort).limit(limit).lean()
          return buildConnection(showCredits, { first: args.first, sortField: 'order', maxLimit: 100 })
        }
      },
      castHeadshots: {
        type: new GraphQLList(require('../person/personTypes').personType),
        description:
          'Deduped cast members that have a headshot, across all runs (top-billed first). Feeds the Mondrian fallback poster used when a show has no poster art.',
        resolve: async (show: any, _args: any, ctx: any) => {
          const MAX = 8
          const { CreditModel } = require('../credit/creditModel')
          const { PersonModel } = require('../person/personModel')
          const runs = ctx.loaders
            ? await ctx.loaders.runsByShowLoader.load(show._id.toString())
            : await RunModel.find({ show: show._id }, '_id').lean()
          const seen = new Set<string>()
          const out: any[] = []
          for (const run of runs) {
            if (out.length >= MAX) break
            const credits = ctx.loaders
              ? await ctx.loaders.creditsByRunLoader.load(run._id.toString())
              : await CreditModel.find({ run: run._id }).sort({ order: 1 }).lean()
            for (const credit of credits) {
              if (out.length >= MAX) break
              if (credit.creditType !== 'cast' || !credit.person) continue
              const pid = credit.person.toString()
              if (seen.has(pid)) continue
              seen.add(pid)
              const person = ctx.loaders
                ? await ctx.loaders.personLoader.load(pid)
                : await PersonModel.findById(pid).lean()
              if (person?.headshotUrl) out.push(person)
            }
          }
          return out
        }
      },
      source: {
        type: require('../dataSource/dataSourceTypes').dataSourceType,
        resolve: async (show: any, _args: any, ctx: any) => {
          if (!show.source) return null
          if (ctx.loaders) return ctx.loaders.dataSourceLoader.load(show.source.toString())
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
