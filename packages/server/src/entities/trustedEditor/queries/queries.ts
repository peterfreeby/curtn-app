import { GraphQLBoolean, GraphQLList, GraphQLNonNull } from 'graphql'
import { TrustedEditorModel } from '../trustedEditorModel'
import { trustedEditorType } from '../trustedEditorTypes'

// Phase 5 — trust dashboard queries.
//   myGrantedTrustedEditors: grants the user has made (active by default;
//     pass includeRevoked: true to see history).
//   myReceivedTrustedEditors: grants where the recipient is the user. (Unit
//     recipients are visible to the unit's claimant via the granted side —
//     for v1 we keep the received list user-only to mirror the dashboard.)

export const trustedEditorQueries = {
  myGrantedTrustedEditors: {
    type: new GraphQLList(trustedEditorType),
    description: 'Trusted-editor grants the authenticated user has made.',
    args: {
      includeRevoked: { type: GraphQLBoolean },
    },
    resolve: async (_: any, args: any, ctx: any) => {
      if (!ctx.user) return []
      const filter: Record<string, any> = { grantedBy: ctx.user.id }
      if (!args.includeRevoked) filter.revokedAt = null
      const rows = await TrustedEditorModel.find(filter)
        .sort({ createdAt: -1 })
        .limit(200)
        .lean()
      for (const r of rows as any[]) {
        if (r && r._id && !r.id) r.id = r._id.toString()
      }
      return rows
    },
  },

  myReceivedTrustedEditors: {
    type: new GraphQLList(trustedEditorType),
    description: 'Trusted-editor grants where the authenticated user is the recipient.',
    args: {
      includeRevoked: { type: GraphQLBoolean },
    },
    resolve: async (_: any, args: any, ctx: any) => {
      if (!ctx.user) return []
      const filter: Record<string, any> = {
        'recipient.kind': 'User',
        'recipient.id': ctx.user.id,
      }
      if (!args.includeRevoked) filter.revokedAt = null
      const rows = await TrustedEditorModel.find(filter)
        .sort({ createdAt: -1 })
        .limit(200)
        .lean()
      for (const r of rows as any[]) {
        if (r && r._id && !r.id) r.id = r._id.toString()
      }
      return rows
    },
  },
}
