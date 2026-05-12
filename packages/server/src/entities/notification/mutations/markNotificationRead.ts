import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId, fromGlobalId } from 'graphql-relay'
import { notificationType } from '../notificationTypes'
import { NotificationModel } from '../notificationModel'
import { errorField } from '../../../graphql/errorField'

export const markNotificationRead = mutationWithClientMutationId({
  name: 'markNotificationRead',
  description: 'Mark a single notification as read.',
  inputFields: {
    notificationId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Global ID of the notification (relay format).'
    }
  },
  outputFields: {
    notification: {
      type: notificationType,
      resolve: response => response.notification
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    const { id } = fromGlobalId(input.notificationId)
    const notification = await NotificationModel.findById(id)
    if (!notification) return { error: 'Notification not found' }
    if (notification.recipient.toString() !== ctx.user.id) {
      return { error: 'Not your notification' }
    }

    if (!notification.readAt) {
      notification.readAt = new Date()
      await notification.save()
    }

    return { notification }
  }
})
