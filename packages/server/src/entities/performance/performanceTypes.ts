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
        resolve: async performance => performance.run ? await RunModel.findById(performance.run) : null
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
        resolve: async performance => await VenueModel.findById(performance.venueId)
      },
      stageOverride: {
        type: require('../stage/stageTypes').stageType,
        description: 'Stage override for this specific performance (if different from run)',
        resolve: async (performance: any) => {
          if (!performance.stageOverride) return null
          const { StageModel } = require('../stage/stageModel')
          return StageModel.findById(performance.stageOverride)
        }
      },
      effectiveStage: {
        type: require('../stage/stageTypes').stageType,
        description: 'Resolved stage: performance override > run default',
        resolve: async (performance: any) => {
          const { StageModel } = require('../stage/stageModel')
          if (performance.stageOverride) return StageModel.findById(performance.stageOverride)
          const run = await RunModel.findById(performance.run)
          if (run?.stage) return StageModel.findById(run.stage)
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
        resolve: async (performance: any) => {
          if (performance.metadataOverrides?.imageUrl) return performance.metadataOverrides.imageUrl
          const run = await RunModel.findById(performance.run)
          if (run?.posterUrl) return run.posterUrl
          if (run?.imageUrl) return run.imageUrl
          const show = await ShowModel.findById(run?.show)
          return show?.posterUrl || show?.imageUrl || null
        }
      },
      effectiveDescription: {
        type: GraphQLString,
        description: 'Resolved description: performance override > run > show',
        resolve: async performance => {
          if (performance.metadataOverrides?.description) {
            return performance.metadataOverrides.description
          }
          const run = await RunModel.findById(performance.run)
          if (run?.description) return run.description
          const show = await ShowModel.findById(run?.show)
          return show?.description
        }
      },
      effectiveCast: {
        type: new GraphQLList(creditType),
        description: 'Cast with per-performance overrides applied',
        resolve: async performance => {
          const defaultCast = await CreditModel.find({ run: performance.run, creditType: 'cast' }).sort({ order: 1 })
          if (!performance.creditOverrides) return defaultCast

          const removedIds = new Set((performance.creditOverrides.removed || []).map((id: any) => id.toString()))
          let result = defaultCast.filter(c => !removedIds.has(c._id.toString()))

          if (performance.creditOverrides.added?.length) {
            const added = await CreditModel.find({ _id: { $in: performance.creditOverrides.added } })
            result = [...result, ...added]
          }

          return result
        }
      },
      effectiveCrew: {
        type: new GraphQLList(creditType),
        description: 'Crew with per-performance overrides applied',
        resolve: async performance => {
          const defaultCrew = await CreditModel.find({ run: performance.run, creditType: 'crew' }).sort({ order: 1 })
          if (!performance.creditOverrides) return defaultCrew

          const removedIds = new Set((performance.creditOverrides.removed || []).map((id: any) => id.toString()))
          let result = defaultCrew.filter(c => !removedIds.has(c._id.toString()))

          if (performance.creditOverrides.added?.length) {
            const added = await CreditModel.find({ _id: { $in: performance.creditOverrides.added } })
            result = [...result, ...added]
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
