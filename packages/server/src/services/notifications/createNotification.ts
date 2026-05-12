import { Types } from 'mongoose'
import { NotificationModel, NotificationKind } from '../../entities/notification/notificationModel'

// Single entry point for creating in-app notifications. Every mutation that
// fires an event calls this helper. Decoupled so future external channels
// (email / SMS) can subscribe to Notification creation without scattering
// delivery code across every mutation.

export interface CreateNotificationOptions {
  recipient: string | Types.ObjectId
  kind: NotificationKind
  context?: Record<string, any>
}

export async function createNotification(opts: CreateNotificationOptions) {
  return NotificationModel.create({
    recipient: opts.recipient,
    kind: opts.kind,
    context: opts.context ?? {}
  })
}
