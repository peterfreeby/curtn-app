import { GraphQLInt, GraphQLNonNull } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { NotificationModel } from '../notificationModel'
import { errorField } from '../../../graphql/errorField'

export const markAllNotificationsRead = mutationWithClientMutationId({
  name: 'markAllNotificationsRead',
  description: 'Mark all of the current user\'s notifications as read.',
  inputFields: {},
  outputFields: {
    markedCount: {
      type: new GraphQLNonNull(GraphQLInt),
      resolve: response => response.markedCount ?? 0
    },
    ...errorField
  },
  mutateAndGetPayload: async (_input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized', markedCount: 0 }

    const result = await NotificationModel.updateMany(
      { recipient: ctx.user.id, readAt: null },
      { $set: { readAt: new Date() } }
    )

    return { markedCount: result.modifiedCount }
  }
})
