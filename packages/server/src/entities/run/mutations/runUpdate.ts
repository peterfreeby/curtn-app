import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { runType } from '../runTypes'
import { RunModel } from '../runModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'
import { writeAuditLog } from '../../../services/auditLog/writeAuditLog'

export const runUpdate = mutationWithClientMutationId({
  name: 'runUpdate',
  description: 'Update an existing run (admin only)',
  inputFields: {
    runId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the run to update'
    },
    expectedUpdatedAt: {
      type: GraphQLString,
      description: 'Optimistic concurrency token. ISO string of updatedAt at edit-form load time.'
    },
    title: {
      type: GraphQLString,
      description: 'Run-specific title'
    },
    description: {
      type: GraphQLString,
      description: 'Run description'
    },
    intermissions: {
      type: GraphQLString,
      description: 'Number of intermissions (string, parsed to int)'
    },
    lineupPerPerformance: {
      type: GraphQLString,
      description: 'Override the variable-lineup flag ("true"/"false"). true = cast varies per performance (no aggregate run cast); false = fixed cast shared across performances.'
    },
    startDate: {
      type: GraphQLString,
      description: 'Start date (ISO string)'
    },
    endDate: {
      type: GraphQLString,
      description: 'End date (ISO string)'
    },
    imageUrl: {
      type: GraphQLString,
      description: 'Image URL (from Vercel Blob)'
    },
    posterUrl: {
      type: GraphQLString,
      description: 'Poster URL — portrait poster image (from Vercel Blob)'
    },
    showId: {
      type: GraphQLString,
      description: 'MongoDB ObjectId of the show this run belongs to'
    },
    venueIds: {
      type: GraphQLString,
      description: 'JSON array of venue MongoDB ObjectIds'
    },
    productionCompanyId: {
      type: GraphQLString,
      description: 'MongoDB ObjectId of the production company (empty string to clear)'
    },
    stageId: {
      type: GraphQLString,
      description: 'MongoDB ObjectId of the stage (empty string to clear)'
    }
  },
  outputFields: {
    run: {
      type: runType,
      resolve: response => response.run
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    try {
      const run = await RunModel.findById(input.runId)
      if (!run) return { error: 'Run not found' }

      if (input.expectedUpdatedAt) {
        const submitted = new Date(input.expectedUpdatedAt).getTime()
        const current = (run as any).updatedAt?.getTime() ?? 0
        if (current > submitted) {
          return { error: `STALE_VERSION: record changed at ${(run as any).updatedAt?.toISOString()}` }
        }
      }

      const updates: Record<string, any> = {}

      if (input.title !== undefined) updates.title = input.title
      if (input.description !== undefined) updates.description = input.description
      if (input.intermissions !== undefined && input.intermissions !== '') updates.intermissions = parseInt(input.intermissions, 10) || 0
      if (input.lineupPerPerformance !== undefined && input.lineupPerPerformance !== '') {
        updates.lineupPerPerformance = input.lineupPerPerformance === 'true'
      }
      if (input.startDate !== undefined && input.startDate !== '') updates.startDate = new Date(input.startDate)
      if (input.endDate !== undefined && input.endDate !== '') updates.endDate = new Date(input.endDate)
      if (input.imageUrl !== undefined && input.imageUrl !== '') updates.imageUrl = input.imageUrl
      if (input.posterUrl !== undefined && input.posterUrl !== '') updates.posterUrl = input.posterUrl
      if (input.showId !== undefined && input.showId !== '') updates.show = input.showId
      if (input.venueIds !== undefined) {
        try {
          updates.venues = JSON.parse(input.venueIds)
        } catch {
          return { error: 'Invalid venueIds JSON' }
        }
      }
      if (input.productionCompanyId !== undefined) {
        updates.productionCompany = input.productionCompanyId === '' ? null : input.productionCompanyId
      }
      if (input.stageId !== undefined) {
        updates.stage = input.stageId === '' ? null : input.stageId
      }

      if (Object.keys(updates).length === 0) {
        return { run }
      }

      const oldDoc = run.toObject()
      const updated = await RunModel.findByIdAndUpdate(input.runId, updates, { new: true })
      if (updated) {
        await writeAuditLog({
          target: { kind: 'Run', id: updated._id },
          author: { kind: 'User', userId: ctx.user.id },
          oldDoc,
          newDoc: updated.toObject(),
          approvalSource: 'admin-override',
        })
      }
      return { run: updated }
    } catch (err) {
      console.error('runUpdate error:', err)
      return { error: 'Failed to update run' }
    }
  }
})
