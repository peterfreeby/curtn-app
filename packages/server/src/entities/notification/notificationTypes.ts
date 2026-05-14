import {
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString
} from 'graphql'
import { connectionDefinitions, globalIdField } from 'graphql-relay'
import { nodeInterface } from '../../graphql/nodeInterface'
import { entityRegister } from '../../graphql/entityHelpers'
import { NotificationModel } from './notificationModel'

// `context` is a JSON blob whose shape varies by `kind`. The frontend
// per-kind render functions consume it. Exposing as a JSON string keeps the
// GraphQL surface simple; we don't need typed sub-objects per kind.

export const notificationType: GraphQLObjectType = new GraphQLObjectType({
  name: 'Notification',
  description: 'An in-app notification surfaced to a recipient user.',
  interfaces: () => [nodeInterface],
  fields: () => ({
    id: globalIdField('Notification', n => n._id),
    kind: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Kind of notification (claim_approved, transfer_received, etc.)',
      resolve: n => n.kind
    },
    contextJson: {
      type: GraphQLString,
      description: 'JSON-encoded context payload — shape depends on `kind`.',
      resolve: n => (n.context ? JSON.stringify(n.context) : '{}')
    },
    readAt: {
      type: GraphQLString,
      description: 'ISO timestamp when read; null if unread.',
      resolve: n => n.readAt?.toISOString() ?? null
    },
    createdAt: {
      type: GraphQLString,
      description: 'When the notification was created (ISO).',
      resolve: n => n.createdAt?.toISOString()
    }
  })
})

export const { connectionType: NotificationConnection, edgeType: NotificationEdge } = connectionDefinitions({
  nodeType: notificationType
})

entityRegister({
  type: notificationType,
  nodeResolver: async (id) => await NotificationModel.findById(id)
})
