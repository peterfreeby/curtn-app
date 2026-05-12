import { GraphQLString, GraphQLNonNull } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { Types } from 'mongoose'
import { dataSourceType } from '../dataSourceTypes'
import { DataSourceModel } from '../dataSourceModel'
import { VenueModel } from '../../venue/venueModel'
import { errorField } from '../../../graphql/errorField'
import { createNotification } from '../../../services/notifications/createNotification'

// Phase 6 — claimant connects an RSS or iCal sync source to a unit they own.
// v1 only supports venue targets (the most common case from the scoping doc).
// Effects:
//   - Validate the caller is the unit's claimant and the unit is claimed-passive.
//   - Create a DataSource with purpose='claimant-sync' and createdBy=caller.
//   - Transition the unit to claimed-synced healthy + set syncSourceConnectedAt.
//   - Fire a sync_connected confirmation notification.
// The first sync run is fired by the /api/cron/sync-runner cron tick.

export const createClaimantSync = mutationWithClientMutationId({
  name: 'createClaimantSync',
  description: 'Claimant connects an RSS or iCal feed to a unit they own',
  inputFields: {
    targetKind: {
      type: new GraphQLNonNull(GraphQLString),
      description: "'venue' (v1 only)"
    },
    targetId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'ID of the unit being synced'
    },
    feedType: {
      type: new GraphQLNonNull(GraphQLString),
      description: "'rss' or 'ical'"
    },
    url: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Feed URL'
    },
    name: {
      type: GraphQLString,
      description: 'Optional human label'
    },
  },
  outputFields: {
    dataSource: {
      type: dataSourceType,
      resolve: r => r.dataSource ?? null,
    },
    ...errorField,
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    if (input.targetKind !== 'venue') {
      return { error: 'Only venue targets are supported in v1' }
    }
    if (input.feedType !== 'rss' && input.feedType !== 'ical') {
      return { error: 'feedType must be rss or ical' }
    }
    if (!input.url?.trim()) return { error: 'url is required' }

    if (!Types.ObjectId.isValid(input.targetId)) {
      return { error: 'Invalid targetId' }
    }

    const venue = await VenueModel.findById(input.targetId)
    if (!venue) return { error: 'Venue not found' }
    if (!venue.claimedBy || venue.claimedBy.toString() !== ctx.user.id) {
      return { error: 'You are not the claimant of this venue' }
    }
    if (venue.claimState !== 'claimed-passive') {
      return { error: `Cannot connect sync from state ${venue.claimState}; disconnect first` }
    }

    // One active claimant-sync DataSource per venue.
    const existing = await DataSourceModel.findOne({
      associatedVenue: venue._id,
      purpose: 'claimant-sync',
      isActive: true,
    })
    if (existing) {
      return { error: 'A claimant sync is already connected — disconnect first' }
    }

    const cooldownHours = input.feedType === 'rss' ? 0.5 : 1
    const dataSource = await new DataSourceModel({
      name: input.name?.trim() || `${venue.name} (${input.feedType})`,
      type: input.feedType,
      purpose: 'claimant-sync',
      url: input.url.trim(),
      associatedVenue: venue._id,
      cooldownHours,
      isActive: true,
      createdBy: ctx.user.id,
    }).save()

    venue.claimState = 'claimed-synced'
    venue.syncHealth = 'healthy'
    venue.syncSourceConnectedAt = new Date()
    await venue.save()

    await createNotification({
      recipient: ctx.user.id,
      kind: 'sync_connected',
      context: {
        dataSourceId: dataSource._id.toString(),
        targetKind: 'venue',
        targetId: venue._id.toString(),
        targetName: venue.name,
        targetSlug: venue.slug,
        feedType: input.feedType,
        url: input.url.trim(),
      },
    })

    return { dataSource }
  },
})
