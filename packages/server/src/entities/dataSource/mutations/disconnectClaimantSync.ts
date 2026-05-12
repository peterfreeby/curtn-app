import { GraphQLString, GraphQLNonNull, GraphQLBoolean } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { Types } from 'mongoose'
import { DataSourceModel } from '../dataSourceModel'
import { VenueModel } from '../../venue/venueModel'
import { errorField } from '../../../graphql/errorField'
import { createNotification } from '../../../services/notifications/createNotification'

// Phase 6 — claimant disconnects their sync source. Deactivates the
// DataSource (we keep the row for the audit trail rather than deleting) and
// reverts the unit to claimed-passive. Scraper resumes normal PendingImport
// publishing for the unit's next scrape.

export const disconnectClaimantSync = mutationWithClientMutationId({
  name: 'disconnectClaimantSync',
  description: 'Claimant disconnects their sync source and reverts to passive',
  inputFields: {
    dataSourceId: {
      type: new GraphQLNonNull(GraphQLString),
    },
  },
  outputFields: {
    ok: {
      type: GraphQLBoolean,
      resolve: r => !!r.ok,
    },
    ...errorField,
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    if (!Types.ObjectId.isValid(input.dataSourceId)) return { error: 'Invalid dataSourceId' }

    const ds = await DataSourceModel.findById(input.dataSourceId)
    if (!ds) return { error: 'DataSource not found' }
    if (ds.purpose !== 'claimant-sync') return { error: 'Not a claimant sync source' }
    if (ds.createdBy.toString() !== ctx.user.id) {
      return { error: 'You did not create this sync source' }
    }

    // Mark inactive (preserve the row for the audit trail).
    ds.isActive = false
    ds.disabledReason = 'disconnected by claimant'
    await ds.save()

    // Revert the associated venue to passive.
    if (ds.associatedVenue) {
      const venue = await VenueModel.findById(ds.associatedVenue)
      if (venue && venue.claimState === 'claimed-synced') {
        venue.claimState = 'claimed-passive'
        venue.syncHealth = null
        venue.syncSourceConnectedAt = null
        await venue.save()

        if (venue.claimedBy) {
          await createNotification({
            recipient: venue.claimedBy,
            kind: 'sync_disconnected',
            context: {
              dataSourceId: ds._id.toString(),
              targetKind: 'venue',
              targetId: venue._id.toString(),
              targetName: venue.name,
              targetSlug: venue.slug,
            },
          })
        }
      }
    }

    return { ok: true }
  },
})
