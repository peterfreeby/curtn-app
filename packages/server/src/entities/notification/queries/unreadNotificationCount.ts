import { GraphQLFieldConfig, GraphQLInt, GraphQLNonNull } from 'graphql'
import { NotificationModel } from '../notificationModel'

export const unreadNotificationCount: GraphQLFieldConfig<any, any> = {
  type: new GraphQLNonNull(GraphQLInt),
  description: 'Count of unread notifications for the current user. Returns 0 when not authenticated.',
  resolve: async (_, _args, ctx) => {
    if (!ctx.user) return 0
    return NotificationModel.countDocuments({ recipient: ctx.user.id, readAt: null })
  }
}
