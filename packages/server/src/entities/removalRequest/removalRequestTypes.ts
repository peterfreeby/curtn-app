import { GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { connectionDefinitions, globalIdField } from 'graphql-relay'
import { nodeInterface } from '../../graphql/nodeInterface'
import { entityRegister } from '../../graphql/entityHelpers'
import { RemovalRequestModel } from './removalRequestModel'

export const removalRequestType: GraphQLObjectType = new GraphQLObjectType({
  name: 'RemovalRequest',
  description: 'A user-submitted request to hide a specific audit log entry.',
  interfaces: () => [nodeInterface],
  fields: () => {
    const { userType } = require('../user/userTypes')
    return {
      id: globalIdField('RemovalRequest', r => r.id),
      reason: { type: new GraphQLNonNull(GraphQLString), resolve: (r: any) => r.reason },
      category: { type: new GraphQLNonNull(GraphQLString), resolve: (r: any) => r.category },
      status: { type: new GraphQLNonNull(GraphQLString), resolve: (r: any) => r.status },
      targetAuditLogId: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: (r: any) => r.targetAuditLog?.toString(),
      },
      requester: {
        type: userType,
        resolve: async (r: any) => {
          if (!r.requester) return null
          const { UserModel } = require('../user/userModel')
          return UserModel.findById(r.requester)
        },
      },
      reviewerNotes: { type: GraphQLString, resolve: (r: any) => r.reviewerNotes ?? null },
      reviewedAt: { type: GraphQLString, resolve: (r: any) => r.reviewedAt?.toISOString() ?? null },
      createdAt: { type: new GraphQLNonNull(GraphQLString), resolve: (r: any) => r.createdAt?.toISOString() },
    }
  }
})

export const { connectionType: RemovalRequestConnection } = connectionDefinitions({
  nodeType: removalRequestType,
})

entityRegister({
  type: removalRequestType,
  nodeResolver: async (id) => await RemovalRequestModel.findById(id)
})
