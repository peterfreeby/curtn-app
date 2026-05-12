import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { RemovalRequestModel, RemovalRequestCategory } from '../removalRequestModel'
import { AuditLogModel } from '../../auditLog/auditLogModel'
import { removalRequestType } from '../removalRequestTypes'

const VALID_CATEGORIES = new Set(['deadname', 'harassment', 'copyright', 'privacy', 'other'])

export const submitRemovalRequest = mutationWithClientMutationId({
  name: 'submitRemovalRequest',
  description: 'Submit a request to hide a specific audit log entry (admin review required).',
  inputFields: {
    auditLogEntryId: { type: new GraphQLNonNull(GraphQLString) },
    reason: { type: new GraphQLNonNull(GraphQLString) },
    category: { type: new GraphQLNonNull(GraphQLString) }
  },
  outputFields: {
    removalRequest: {
      type: removalRequestType,
      resolve: (r: any) => r.removalRequest
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ auditLogEntryId, reason, category }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    if (!VALID_CATEGORIES.has(category)) {
      return { error: `Invalid category: ${category}` }
    }
    if (!reason || reason.trim().length < 3) {
      return { error: 'Reason is required' }
    }

    const entry = await AuditLogModel.findById(auditLogEntryId).select('_id').lean()
    if (!entry) return { error: 'Audit log entry not found' }

    const removalRequest = await RemovalRequestModel.create({
      requester: ctx.user.id,
      targetAuditLog: auditLogEntryId,
      reason: reason.trim(),
      category: category as RemovalRequestCategory,
      status: 'pending',
    })

    return { removalRequest }
  }
})
