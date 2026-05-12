import { GraphQLNonNull, GraphQLString } from 'graphql'
import { connectionArgs, connectionFromArray } from 'graphql-relay'
import { AuditLogConnection } from '../auditLogTypes'
import { AuditLogModel, AuditTargetKind } from '../auditLogModel'
import { UserModel } from '../../user/userModel'

// Public edit history for a target. Non-admin viewers see hidden rows as
// placeholders (the row is still returned but its `hidden` field is true and
// the `diff` JSON is suppressed in the GraphQL resolver below — see the
// renderer side). Admins see hidden rows in full.

export const auditLogQueries = {
  auditLog: {
    type: AuditLogConnection,
    description: 'Edit history rows for a target (Venue/ProductionCompany/Person/Show/Run/Performance/Stage). Newest first.',
    args: {
      targetKind: { type: new GraphQLNonNull(GraphQLString) },
      targetId: { type: new GraphQLNonNull(GraphQLString) },
      ...connectionArgs,
    },
    resolve: async (_: any, args: any, ctx: any) => {
      const isAdmin = ctx.user
        ? !!(await UserModel.findById(ctx.user.id).select('isAdmin').lean())?.isAdmin
        : false

      const match: Record<string, any> = {
        'target.kind': args.targetKind as AuditTargetKind,
        'target.id': args.targetId,
      }

      const rows = await AuditLogModel.find(match)
        .sort({ createdAt: -1 })
        .limit(200)
        .lean()

      // Non-admins: keep the row but blank out the diff for hidden ones so a
      // placeholder still renders in the timeline. Admins see full diffs.
      const filtered = rows.map((r: any) => {
        if (r.hiddenAt && !isAdmin) {
          return { ...r, diff: { _hidden: true }, hiddenReason: null }
        }
        return r
      })

      // Restore `id` for graphql-relay (since .lean() strips virtuals).
      for (const r of filtered) {
        if (r && r._id && !r.id) r.id = r._id.toString()
      }

      return connectionFromArray(filtered, args)
    }
  }
}
