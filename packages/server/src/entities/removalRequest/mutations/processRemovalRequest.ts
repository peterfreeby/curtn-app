import { GraphQLBoolean, GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { UserModel } from '../../user/userModel'
import { RemovalRequestModel } from '../removalRequestModel'
import { AuditLogModel } from '../../auditLog/auditLogModel'
import { removalRequestType } from '../removalRequestTypes'

// Admin reviews a pending RemovalRequest. Approve → flips the AuditLog row's
// hidden* fields. Decline → records the decision; nothing else changes.

export const processRemovalRequest = mutationWithClientMutationId({
  name: 'processRemovalRequest',
  description: 'Admin: approve or decline a pending removal request.',
  inputFields: {
    removalRequestId: { type: new GraphQLNonNull(GraphQLString) },
    approve: { type: new GraphQLNonNull(GraphQLBoolean) },
    reviewerNotes: { type: GraphQLString }
  },
  outputFields: {
    removalRequest: {
      type: removalRequestType,
      resolve: (r: any) => r.removalRequest
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ removalRequestId, approve, reviewerNotes }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    const request = await RemovalRequestModel.findById(removalRequestId)
    if (!request) return { error: 'Removal request not found' }
    if (request.status !== 'pending') return { error: `Already ${request.status}` }

    if (approve) {
      await AuditLogModel.findByIdAndUpdate(request.targetAuditLog, {
        hiddenAt: new Date(),
        hiddenBy: ctx.user.id,
        hiddenReason: reviewerNotes || request.reason,
      })
      request.status = 'approved'
    } else {
      request.status = 'declined'
    }

    request.reviewedAt = new Date()
    request.reviewedBy = ctx.user.id
    if (reviewerNotes !== undefined) request.reviewerNotes = reviewerNotes
    await request.save()

    return { removalRequest: request }
  }
})
