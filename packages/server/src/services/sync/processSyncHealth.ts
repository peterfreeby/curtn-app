import { DataSourceModel } from '../../entities/dataSource/dataSourceModel'
import { VenueModel } from '../../entities/venue/venueModel'
import { NotificationModel } from '../../entities/notification/notificationModel'
import { createNotification } from '../notifications/createNotification'

// Phase 6 D6 — daily stale-feed cron.
//
// For each active claimant-sync DataSource:
//   - lastSuccessAt < (now - 3 weeks) AND venue.syncHealth === 'healthy'
//     → mark venue stale + fire sync_stale_alert (once)
//   - lastSuccessAt < (now - 6 weeks)
//     → mark DataSource inactive, transition venue → claimed-passive,
//       clear syncHealth, fire sync_reverted_to_passive (once)
//   - venue.syncHealth === 'stale' but a successful poll has happened since
//     the alert (handled by runSync) → no-op here (recovery happens at poll
//     time). This cron does NOT downgrade stale → healthy on its own.
//
// "Once" semantics use the same "look up an existing Notification" guard as
// processClaimExpire.

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const THREE_WEEKS_MS = 21 * ONE_DAY_MS
const SIX_WEEKS_MS = 42 * ONE_DAY_MS

interface HealthResult {
  staleMarked: number
  reverted: number
  recovered: number
}

async function notificationAlreadyFired(
  recipient: any,
  kind: string,
  venueId: any,
): Promise<boolean> {
  const existing = await NotificationModel.findOne({
    recipient,
    kind,
    'context.targetKind': 'venue',
    'context.targetId': venueId.toString(),
  }).select('_id').lean()
  return !!existing
}

export async function processSyncHealth(opts: { now?: Date } = {}): Promise<HealthResult> {
  const now = opts.now ?? new Date()
  const staleThreshold = new Date(now.getTime() - THREE_WEEKS_MS)
  const revertThreshold = new Date(now.getTime() - SIX_WEEKS_MS)

  let staleMarked = 0
  let reverted = 0
  let recovered = 0

  const dsList = await DataSourceModel.find({
    purpose: 'claimant-sync',
    isActive: true,
  })

  for (const ds of dsList) {
    if (!ds.associatedVenue) continue
    const venue = await VenueModel.findById(ds.associatedVenue)
    if (!venue) continue

    const last = ds.lastSuccessAt ? new Date(ds.lastSuccessAt).getTime() : null

    // 6-week revert.
    if (last !== null && last < revertThreshold.getTime()) {
      ds.isActive = false
      ds.disabledReason = 'sync silent 6+ weeks; reverted to passive'
      await ds.save()

      if (venue.claimState === 'claimed-synced') {
        venue.claimState = 'claimed-passive'
        venue.syncHealth = null
        venue.syncSourceConnectedAt = null
        await venue.save()
      }

      if (venue.claimedBy && !(await notificationAlreadyFired(venue.claimedBy, 'sync_reverted_to_passive', venue._id))) {
        await createNotification({
          recipient: venue.claimedBy,
          kind: 'sync_reverted_to_passive',
          context: {
            dataSourceId: ds._id.toString(),
            targetKind: 'venue',
            targetId: venue._id.toString(),
            targetName: venue.name,
            targetSlug: venue.slug,
          },
        })
      }
      reverted++
      continue
    }

    // 3-week stale.
    if (last !== null && last < staleThreshold.getTime() && venue.syncHealth === 'healthy') {
      venue.syncHealth = 'stale'
      await venue.save()

      if (venue.claimedBy && !(await notificationAlreadyFired(venue.claimedBy, 'sync_stale_alert', venue._id))) {
        await createNotification({
          recipient: venue.claimedBy,
          kind: 'sync_stale_alert',
          context: {
            dataSourceId: ds._id.toString(),
            targetKind: 'venue',
            targetId: venue._id.toString(),
            targetName: venue.name,
            targetSlug: venue.slug,
          },
        })
      }
      staleMarked++
      continue
    }

    // Recovery (defense-in-depth — runSync also handles this synchronously).
    if (venue.syncHealth === 'stale' && last !== null && last >= staleThreshold.getTime()) {
      venue.syncHealth = 'healthy'
      await venue.save()
      if (venue.claimedBy) {
        await createNotification({
          recipient: venue.claimedBy,
          kind: 'sync_recovered',
          context: {
            dataSourceId: ds._id.toString(),
            targetKind: 'venue',
            targetId: venue._id.toString(),
            targetName: venue.name,
            targetSlug: venue.slug,
          },
        })
      }
      recovered++
    }
  }

  return { staleMarked, reverted, recovered }
}
