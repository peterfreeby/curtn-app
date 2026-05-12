import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { UserModel } from '../../user/userModel'
import { AuditLogModel } from '../auditLogModel'
import { auditLogType } from '../auditLogTypes'

// Admin-only direct hide. Used both by the RemovalRequest approval flow
// and for urgent ad-hoc cases. Sets hiddenAt/hiddenBy/hiddenReason; the row
// stays in the collection but is suppressed from public history.

export const hideAuditLogEntry = mutationWithClientMutationId({
  name: 'hideAuditLogEntry',
  description: 'Admin-only: hide an audit log entry from public history (revision deletion).',
  inputFields: {
    auditLogEntryId: { type: new GraphQLNonNull(GraphQLString) },
    reason: { type: new GraphQLNonNull(GraphQLString) }
  },
  outputFields: {
    auditLogEntry: {
      type: auditLogType,
      resolve: (r: any) => r.auditLogEntry
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ auditLogEntryId, reason }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    const entry = await AuditLogModel.findByIdAndUpdate(
      auditLogEntryId,
      {
        hiddenAt: new Date(),
        hiddenBy: ctx.user.id,
        hiddenReason: reason,
      },
      { new: true }
    )
    if (!entry) return { error: 'Audit log entry not found' }

    return { auditLogEntry: entry }
  }
})
