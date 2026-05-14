import { GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { connectionDefinitions, globalIdField } from 'graphql-relay'
import { nodeInterface } from '../../graphql/nodeInterface'
import { entityRegister } from '../../graphql/entityHelpers'
import { AuditLogModel } from './auditLogModel'

const auditAuthorType = new GraphQLObjectType({
  name: 'AuditAuthor',
  fields: () => {
    const { userType } = require('../user/userTypes')
    return {
      kind: { type: new GraphQLNonNull(GraphQLString), resolve: (a: any) => a.kind },
      label: { type: GraphQLString, resolve: (a: any) => a.label ?? null },
      user: {
        type: userType,
        description: 'Populated when author.kind === "User".',
        resolve: async (a: any) => {
          if (!a.userId) return null
          const { UserModel } = require('../user/userModel')
          return UserModel.findById(a.userId)
        }
      },
    }
  }
})

const auditTargetType = new GraphQLObjectType({
  name: 'AuditTarget',
  fields: () => ({
    kind: { type: new GraphQLNonNull(GraphQLString), resolve: (t: any) => t.kind },
    targetId: { type: new GraphQLNonNull(GraphQLString), resolve: (t: any) => t.id?.toString() },
  })
})

export const auditLogType: GraphQLObjectType = new GraphQLObjectType({
  name: 'AuditLogEntry',
  description: 'One row of edit history on a record. Append-only.',
  interfaces: () => [nodeInterface],
  fields: () => ({
    id: globalIdField('AuditLogEntry', e => e._id),
    target: { type: new GraphQLNonNull(auditTargetType), resolve: (e: any) => e.target },
    author: { type: new GraphQLNonNull(auditAuthorType), resolve: (e: any) => e.author },
    diffJson: {
      type: GraphQLString,
      description: 'JSON-encoded diff: { fieldName: { old, new } }. Empty {} for record creation.',
      resolve: (e: any) => (e.diff ? JSON.stringify(e.diff) : '{}')
    },
    approvalSource: { type: new GraphQLNonNull(GraphQLString), resolve: (e: any) => e.approvalSource },
    approvalContextJson: {
      type: GraphQLString,
      resolve: (e: any) => (e.approvalContext ? JSON.stringify(e.approvalContext) : '{}')
    },
    isRevert: { type: new GraphQLNonNull(GraphQLString), resolve: (e: any) => e.isRevert ? 'true' : 'false' },
    revertOf: {
      type: GraphQLString,
      description: 'AuditLogEntry id (raw ObjectId string) of the entry this one reverts, if any.',
      resolve: (e: any) => e.revertOf?.toString() ?? null
    },
    hidden: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'true if this entry has been hidden by admin (revision deletion).',
      resolve: (e: any) => e.hiddenAt ? 'true' : 'false'
    },
    createdAt: { type: new GraphQLNonNull(GraphQLString), resolve: (e: any) => e.createdAt?.toISOString() },
  })
})

export const { connectionType: AuditLogConnection } = connectionDefinitions({
  nodeType: auditLogType
})

entityRegister({
  type: auditLogType,
  nodeResolver: async (id) => await AuditLogModel.findById(id)
})
