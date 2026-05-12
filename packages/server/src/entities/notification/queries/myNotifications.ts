import { GraphQLBoolean, GraphQLFieldConfig } from 'graphql'
import { connectionArgs } from 'graphql-relay'
import { NotificationConnection } from '../notificationTypes'
import { NotificationModel } from '../notificationModel'
import { applyCursorToAggregate, buildConnection } from '../../../graphql/cursorPagination'

export const myNotifications: GraphQLFieldConfig<any, any> = {
  type: NotificationConnection,
  description: 'Current user\'s notifications, newest first.',
  args: {
    ...connectionArgs,
    unreadOnly: { type: GraphQLBoolean }
  },
  resolve: async (_, args, ctx) => {
    const empty = { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } }

    if (!ctx.user) return empty

    const match: Record<string, any> = { recipient: ctx.user.id }
    if (args.unreadOnly) match.readAt = null

    const pipeline = applyCursorToAggregate(
      [{ $match: match }],
      { after: args.after, first: args.first, sortField: 'createdAt', sortDirection: -1 }
    )

    const notifications = await NotificationModel.aggregate(pipeline)
    return buildConnection(notifications, { first: args.first, sortField: 'createdAt' })
  }
}
