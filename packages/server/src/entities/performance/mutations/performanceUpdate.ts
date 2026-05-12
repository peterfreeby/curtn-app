import { GraphQLNonNull, GraphQLString, GraphQLBoolean } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { performanceType } from '../performanceTypes'
import { PerformanceModel } from '../performanceModel'
import { errorField } from '../../../graphql/errorField'
import { writeAuditLog } from '../../../services/auditLog/writeAuditLog'
import { canPerform } from '../../../permissions/canPerform'
import { createProposal } from '../../proposal/mutations/createProposal'
import { computeUpdateDiff } from '../../../services/proposalDiff/computeUpdateDiff'

export const performanceUpdate = mutationWithClientMutationId({
  name: 'performanceUpdate',
  description: 'Update an existing performance (admin only)',
  inputFields: {
    performanceId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the performance to update'
    },
    expectedUpdatedAt: {
      type: GraphQLString,
      description: 'Optimistic concurrency token. ISO string of updatedAt at edit-form load time.'
    },
    date: {
      type: GraphQLString,
      description: 'Performance date (ISO string)'
    },
    time: {
      type: GraphQLString,
      description: 'Performance time'
    },
    ticketUrl: {
      type: GraphQLString,
      description: 'Ticket purchase URL'
    },
    soldOut: {
      type: GraphQLBoolean,
      description: 'Whether the performance is sold out'
    },
    description: {
      type: GraphQLString,
      description: 'Performance-level description override'
    },
    imageUrl: {
      type: GraphQLString,
      description: 'Image URL (from Vercel Blob)'
    },
    runId: {
      type: GraphQLString,
      description: 'MongoDB ObjectId of the run this performance belongs to'
    },
    venueId: {
      type: GraphQLString,
      description: 'MongoDB ObjectId of the venue for this performance'
    }
  },
  outputFields: {
    performance: {
      type: performanceType,
      resolve: response => response.performance
    },
    queued: {
      type: GraphQLBoolean,
      resolve: response => !!response.queued
    },
    proposalId: {
      type: GraphQLString,
      resolve: response => response.proposalId ?? null
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    const decision = await canPerform(ctx.user.id, 'performance.edit_date_time', {
      kind: 'Performance',
      id: input.performanceId,
    })
    if (decision.mode === 'denied') {
      return { error: decision.reason || 'Permission denied' }
    }

    try {
      const performance = await PerformanceModel.findById(input.performanceId)
      if (!performance) return { error: 'Performance not found' }

      if (input.expectedUpdatedAt) {
        const submitted = new Date(input.expectedUpdatedAt).getTime()
        const current = (performance as any).updatedAt?.getTime() ?? 0
        if (current > submitted) {
          return { error: `STALE_VERSION: record changed at ${(performance as any).updatedAt?.toISOString()}` }
        }
      }

      const updates: Record<string, any> = {}

      if (input.date !== undefined && input.date !== '') updates.date = new Date(input.date)
      if (input.time !== undefined) updates.time = input.time
      if (input.ticketUrl !== undefined) updates.ticketUrl = input.ticketUrl
      if (input.soldOut !== undefined) updates.soldOut = input.soldOut
      if (input.description !== undefined) updates['metadataOverrides.description'] = input.description
      if (input.imageUrl !== undefined && input.imageUrl !== '') updates['metadataOverrides.imageUrl'] = input.imageUrl
      if (input.runId !== undefined && input.runId !== '') updates.run = input.runId
      if (input.venueId !== undefined && input.venueId !== '') updates.venueId = input.venueId

      if (Object.keys(updates).length === 0) {
        return { performance }
      }

      if (decision.mode === 'queue') {
        const diff = computeUpdateDiff(performance.toObject(), updates)
        if (Object.keys(diff).length === 0) return { performance }
        const result = await createProposal({
          target: { kind: 'Performance', id: performance._id },
          proposer: { kind: 'User', userId: ctx.user.id, label: ctx.user.username },
          diff,
          submissionVersion: (performance as any).updatedAt,
          isJointStewardship: !!decision.isJointStewardship,
        })
        return { queued: true, proposalId: result.proposalId, performance }
      }

      const oldDoc = performance.toObject()
      const updated = await PerformanceModel.findByIdAndUpdate(input.performanceId, updates, { new: true })
      if (updated) {
        await writeAuditLog({
          target: { kind: 'Performance', id: updated._id },
          author: { kind: 'User', userId: ctx.user.id },
          oldDoc,
          newDoc: updated.toObject(),
          approvalSource: 'direct-publish',
        })
      }
      return { performance: updated }
    } catch (err) {
      console.error('performanceUpdate error:', err)
      return { error: 'Failed to update performance' }
    }
  }
})
