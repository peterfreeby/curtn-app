import {
  GraphQLList,
  GraphQLFloat,
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInt
} from 'graphql'
import { nodeInterface } from '../../graphql/nodeInterface'
import { globalIdField, connectionDefinitions, connectionArgs } from 'graphql-relay'
import { applyCursorToQuery, buildConnection } from '../../graphql/cursorPagination'
import { entityRegister } from '../../graphql/entityHelpers'
import { RunModel } from './runModel'
import { ShowModel } from '../show/showModel'
import { ProductionCompanyModel } from '../productionCompany/productionCompanyModel'
import { VenueModel } from '../venue/venueModel'
import { CreditModel } from '../credit/creditModel'
import { ReviewModel } from '../review/reviewModel'
import { SeenModel } from '../seen/seenModel'
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
        resolve: async (run: any, _args: any, ctx: any) => {
          if (run.title) return run.title
          const show = ctx.loaders
            ? await ctx.loaders.showLoader.load(run.show.toString())
            : await ShowModel.findById(run.show)
          return show?.title || 'Untitled'
        }
      },
      show: {
        type: new GraphQLNonNull(showType),
        resolve: async (run: any, _args: any, ctx: any) => {
          if (ctx.loaders) return ctx.loaders.showLoader.load(run.show.toString())
          return ShowModel.findById(run.show)
        }
      },
      productionCompany: {
        type: productionCompanyType,
        resolve: async (run: any, _args: any, ctx: any) => {
          if (!run.productionCompany) return null
          if (ctx.loaders) return ctx.loaders.productionCompanyLoader.load(run.productionCompany.toString())
          return ProductionCompanyModel.findById(run.productionCompany)
        }
      },
      venues: {
        type: new GraphQLNonNull(new GraphQLList(venueType)),
        resolve: async (run: any, _args: any, ctx: any) => {
          if (ctx.loaders) return Promise.all(run.venues.map((id: any) => ctx.loaders.venueLoader.load(id.toString())))
          return VenueModel.find({ _id: { $in: run.venues } })
        }
      },
      stage: {
        type: require('../stage/stageTypes').stageType,
        resolve: async (run: any, _args: any, ctx: any) => {
          if (!run.stage) return null
          if (ctx.loaders) return ctx.loaders.stageLoader.load(run.stage.toString())
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
        args: { ...connectionArgs },
        resolve: async (run: any, args: any) => {
          const { filter, sort, limit } = applyCursorToQuery({ run: run._id }, {
            after: args.after, first: args.first, sortField: 'date', sortDirection: 1, maxLimit: 500
          })
          const performances = await PerformanceModel.find(filter).sort(sort).limit(limit).lean()
          return buildConnection(performances, { first: args.first, sortField: 'date', maxLimit: 500 })
        }
      },
      upcomingPerformances: {
        type: PerformanceConnection,
        description: 'Future showings only',
        args: { ...connectionArgs },
        resolve: async (run: any, args: any) => {
          const { filter, sort, limit } = applyCursorToQuery({ run: run._id, date: { $gte: new Date() } }, {
            after: args.after, first: args.first, sortField: 'date', sortDirection: 1, maxLimit: 200
          })
          const performances = await PerformanceModel.find(filter).sort(sort).limit(limit).lean()
          return buildConnection(performances, { first: args.first, sortField: 'date', maxLimit: 200 })
        }
      },
      cast: {
        type: new GraphQLList(creditType),
        resolve: async (run: any, _args: any, ctx: any) => {
          if (ctx.loaders) {
            const credits = await ctx.loaders.creditsByRunLoader.load(run._id.toString())
            return credits.filter((c: any) => c.creditType === 'cast')
          }
          return CreditModel.find({ run: run._id, creditType: 'cast' }).sort({ order: 1 })
        }
      },
      crew: {
        type: new GraphQLList(creditType),
        resolve: async (run: any, _args: any, ctx: any) => {
          if (ctx.loaders) {
            const credits = await ctx.loaders.creditsByRunLoader.load(run._id.toString())
            return credits.filter((c: any) => c.creditType === 'crew')
          }
          return CreditModel.find({ run: run._id, creditType: 'crew' }).sort({ order: 1 })
        }
      },
      averageRating: {
        type: GraphQLFloat,
        resolve: async (run: any, _args: any, ctx: any) => {
          const performances = ctx.loaders
            ? await ctx.loaders.performancesByRunLoader.load(run._id.toString())
            : await PerformanceModel.find({ run: run._id }, '_id')
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
        resolve: async (run: any, _args: any, ctx: any) => {
          const performances = ctx.loaders
            ? await ctx.loaders.performancesByRunLoader.load(run._id.toString())
            : await PerformanceModel.find({ run: run._id }, '_id')
          const perfIds = performances.map((p: any) => p._id)
          return await ReviewModel.countDocuments({ performance: { $in: perfIds } })
        }
      },
      viewerHasSeen: {
        type: require('graphql').GraphQLBoolean,
        description: 'Whether the current viewer has logged this run (via Seen or Review)',
        resolve: async (run: any, _args: any, ctx: any) => {
          if (!ctx.user) return false
          const seen = await SeenModel.findOne({ user: ctx.user.id, run: run._id })
          if (seen) return true
          const review = await ReviewModel.findOne({ user: ctx.user.id, run: run._id })
          return !!review
        }
      },
      totalAttendees: {
        type: GraphQLInt,
        description: 'Total users who have seen this run (Seen + unique Review users)',
        resolve: async (run: any) => {
          const seenCount = await SeenModel.countDocuments({ run: run._id })
          const reviewUserCount = await ReviewModel.distinct('user', { run: run._id }).then(users => users.length)
          return seenCount + reviewUserCount
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
