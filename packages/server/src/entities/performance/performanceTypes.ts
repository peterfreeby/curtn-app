import {
  GraphQLList,
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLBoolean
} from 'graphql'
import { nodeInterface } from '../../graphql/nodeInterface'
import { globalIdField, connectionDefinitions } from 'graphql-relay'
import { entityRegister } from '../../graphql/entityHelpers'
import { PerformanceModel } from './performanceModel'
import { VenueModel } from '../venue/venueModel'
import { RunModel } from '../run/runModel'
import { ShowModel } from '../show/showModel'
import { CreditModel } from '../credit/creditModel'
import { venueType } from '../venue/venueTypes'

export const performanceType = new GraphQLObjectType({
  name: 'Performance',
  description: 'A single showing/performance instance',
  interfaces: () => [nodeInterface],
  fields: () => {
    const { runType } = require('../run/runTypes')
    const { creditType } = require('../credit/creditType')
    return {
      id: globalIdField('Performance', performance => performance.id),
      run: {
        type: runType,
        resolve: async (performance: any, _args: any, ctx: any) => {
          if (!performance.run) return null
          if (ctx.loaders) return ctx.loaders.runLoader.load(performance.run.toString())
          return RunModel.findById(performance.run)
        }
      },
      date: {
        type: GraphQLString,
        resolve: performance => performance.date?.toISOString() ?? null
      },
      time: {
        type: GraphQLString,
        resolve: performance => performance.time ?? null
      },
      venue: {
        type: venueType,
        resolve: async (performance: any, _args: any, ctx: any) => {
          if (!performance.venueId) return null
          if (ctx.loaders) return ctx.loaders.venueLoader.load(performance.venueId.toString())
          return VenueModel.findById(performance.venueId)
        }
      },
      stageOverride: {
        type: require('../stage/stageTypes').stageType,
        description: 'Stage override for this specific performance (if different from run)',
        resolve: async (performance: any, _args: any, ctx: any) => {
          if (!performance.stageOverride) return null
          if (ctx.loaders) return ctx.loaders.stageLoader.load(performance.stageOverride.toString())
          const { StageModel } = require('../stage/stageModel')
          return StageModel.findById(performance.stageOverride)
        }
      },
      effectiveStage: {
        type: require('../stage/stageTypes').stageType,
        description: 'Resolved stage: performance override > run default',
        resolve: async (performance: any, _args: any, ctx: any) => {
          if (performance.stageOverride) {
            if (ctx.loaders) return ctx.loaders.stageLoader.load(performance.stageOverride.toString())
            const { StageModel } = require('../stage/stageModel')
            return StageModel.findById(performance.stageOverride)
          }
          const run = ctx.loaders
            ? await ctx.loaders.runLoader.load(performance.run.toString())
            : await RunModel.findById(performance.run)
          if (run?.stage) {
            if (ctx.loaders) return ctx.loaders.stageLoader.load(run.stage.toString())
            const { StageModel } = require('../stage/stageModel')
            return StageModel.findById(run.stage)
          }
          return null
        }
      },
      ticketUrl: {
        type: GraphQLString,
        resolve: performance => performance.ticketUrl
      },
      soldOut: {
        type: GraphQLBoolean,
        resolve: performance => performance.soldOut
      },
      imageUrl: {
        type: GraphQLString,
        resolve: perf => perf.metadataOverrides?.imageUrl
      },
      effectivePosterUrl: {
        type: GraphQLString,
        description: 'Resolved poster: performance override > run poster > show poster',
        resolve: async (performance: any, _args: any, ctx: any) => {
          if (performance.metadataOverrides?.imageUrl) return performance.metadataOverrides.imageUrl
          const run = ctx.loaders
            ? await ctx.loaders.runLoader.load(performance.run.toString())
            : await RunModel.findById(performance.run)
          if (run?.posterUrl) return run.posterUrl
          if (run?.imageUrl) return run.imageUrl
          const show = run?.show
            ? (ctx.loaders ? await ctx.loaders.showLoader.load(run.show.toString()) : await ShowModel.findById(run.show))
            : null
          return show?.posterUrl || show?.imageUrl || null
        }
      },
      effectiveDescription: {
        type: GraphQLString,
        description: 'Resolved description: performance override > run > show',
        resolve: async (performance: any, _args: any, ctx: any) => {
          if (performance.metadataOverrides?.description) {
            return performance.metadataOverrides.description
          }
          const run = ctx.loaders
            ? await ctx.loaders.runLoader.load(performance.run.toString())
            : await RunModel.findById(performance.run)
          if (run?.description) return run.description
          const show = run?.show
            ? (ctx.loaders ? await ctx.loaders.showLoader.load(run.show.toString()) : await ShowModel.findById(run.show))
            : null
          return show?.description
        }
      },
      effectiveCast: {
        type: new GraphQLList(creditType),
        description: 'Cast with per-performance overrides applied',
        resolve: async (performance: any, _args: any, ctx: any) => {
          // Variable-lineup runs (recurring showcases, comedy nights) carry no
          // shared default cast — each performance's cast is solely its own
          // creditOverrides.added. See [[Per-Performance Cast Attribution]].
          const run = ctx.loaders
            ? await ctx.loaders.runLoader.load(performance.run.toString())
            : await RunModel.findById(performance.run)
          const lineupPerPerformance = !!run?.lineupPerPerformance

          let defaultCast: any[]
          if (lineupPerPerformance) {
            defaultCast = []
          } else if (ctx.loaders) {
            const allCredits = await ctx.loaders.creditsByRunLoader.load(performance.run.toString())
            defaultCast = allCredits.filter((c: any) => c.creditType === 'cast')
          } else {
            defaultCast = await CreditModel.find({ run: performance.run, creditType: 'cast' }).sort({ order: 1 })
          }
          if (!performance.creditOverrides) return defaultCast

          const removedIds = new Set((performance.creditOverrides.removed || []).map((id: any) => id.toString()))
          let result = defaultCast.filter((c: any) => !removedIds.has(c._id.toString()))

          if (performance.creditOverrides.added?.length) {
            const added = ctx.loaders
              ? await Promise.all(performance.creditOverrides.added.map((id: any) => ctx.loaders.creditLoader.load(id.toString())))
              : await CreditModel.find({ _id: { $in: performance.creditOverrides.added } })
            // Only the cast-typed added credits belong in effectiveCast.
            result = [...result, ...added.filter((c: any) => c && c.creditType === 'cast')]
          }

          return result
        }
      },
      effectiveCrew: {
        type: new GraphQLList(creditType),
        description: 'Crew with per-performance overrides applied',
        resolve: async (performance: any, _args: any, ctx: any) => {
          const run = ctx.loaders
            ? await ctx.loaders.runLoader.load(performance.run.toString())
            : await RunModel.findById(performance.run)
          const lineupPerPerformance = !!run?.lineupPerPerformance

          let defaultCrew: any[]
          if (lineupPerPerformance) {
            defaultCrew = []
          } else if (ctx.loaders) {
            const allCredits = await ctx.loaders.creditsByRunLoader.load(performance.run.toString())
            defaultCrew = allCredits.filter((c: any) => c.creditType === 'crew')
          } else {
            defaultCrew = await CreditModel.find({ run: performance.run, creditType: 'crew' }).sort({ order: 1 })
          }
          if (!performance.creditOverrides) return defaultCrew

          const removedIds = new Set((performance.creditOverrides.removed || []).map((id: any) => id.toString()))
          let result = defaultCrew.filter((c: any) => !removedIds.has(c._id.toString()))

          if (performance.creditOverrides.added?.length) {
            const added = ctx.loaders
              ? await Promise.all(performance.creditOverrides.added.map((id: any) => ctx.loaders.creditLoader.load(id.toString())))
              : await CreditModel.find({ _id: { $in: performance.creditOverrides.added } })
            // Only the crew-typed added credits belong in effectiveCrew.
            result = [...result, ...added.filter((c: any) => c && c.creditType === 'crew')]
          }

          return result
        }
      },
      createdAt: {
        type: GraphQLString,
        resolve: performance => performance.createdAt?.toISOString()
      },
      updatedAt: {
        type: GraphQLString,
        resolve: performance => performance.updatedAt?.toISOString()
      }
    }
  }
})

export const { connectionType: PerformanceConnection, edgeType: PerformanceEdge } = connectionDefinitions({
  nodeType: performanceType
})

entityRegister({
  type: performanceType,
  nodeResolver: async (id) => await PerformanceModel.findById(id)
})
