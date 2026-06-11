import { GraphQLBoolean, GraphQLFloat, GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { venueType } from '../venueTypes'
import { VenueModel } from '../venueModel'
import { PERFORMANCE_TYPES } from '../../show/showModel'
import { errorField } from '../../../graphql/errorField'
import { canPerform } from '../../../permissions/canPerform'
import { bumpForUnit } from '../../../services/claims/bumpClaimantActivity'
import { writeAuditLog } from '../../../services/auditLog/writeAuditLog'
import { createProposal } from '../../proposal/mutations/createProposal'
import { computeUpdateDiff } from '../../../services/proposalDiff/computeUpdateDiff'

export const venueUpdate = mutationWithClientMutationId({
  name: 'venueUpdate',
  description: 'Update an existing venue (admin or claimant)',
  inputFields: {
    venueId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the venue to update'
    },
    expectedUpdatedAt: {
      type: GraphQLString,
      description: 'Optimistic concurrency token. ISO string of updatedAt at edit-form load time. If provided and the record has changed since, returns STALE_VERSION.'
    },
    name: {
      type: GraphQLString,
      description: 'Venue name'
    },
    description: {
      type: GraphQLString,
      description: 'Venue description'
    },
    address: {
      type: GraphQLString,
      description: 'Street address'
    },
    city: {
      type: GraphQLString,
      description: 'City (NYC, Minneapolis, LA)'
    },
    state: {
      type: GraphQLString,
      description: 'State abbreviation (NY, MN, CA)'
    },
    zipCode: {
      type: GraphQLString,
      description: 'ZIP/postal code'
    },
    latitude: {
      type: GraphQLFloat,
      description: 'Latitude from address verification. Set with longitude to place the map pin directly (skips the async geocoding queue).'
    },
    longitude: {
      type: GraphQLFloat,
      description: 'Longitude from address verification. Set with latitude to place the map pin directly.'
    },
    capacity: {
      type: GraphQLString,
      description: 'Seating capacity (string, parsed to int)'
    },
    venueType: {
      type: GraphQLString,
      description: 'Type of venue (theater, comedy-club, etc.)'
    },
    defaultPerformanceType: {
      type: GraphQLString,
      description: 'Default discipline for imported events with no type (a PERFORMANCE_TYPES value; empty string unsets it for mixed-discipline venues)'
    },
    website: {
      type: GraphQLString,
      description: 'Venue website URL'
    },
    phone: {
      type: GraphQLString,
      description: 'Phone number'
    },
    email: {
      type: GraphQLString,
      description: 'Contact email'
    },
    imageUrl: {
      type: GraphQLString,
      description: 'Image URL (from Vercel Blob)'
    },
    permanentlyClosed: {
      type: GraphQLBoolean,
      description: 'Whether this venue is permanently closed'
    },
    closedDate: {
      type: GraphQLString,
      description: 'Date the venue permanently closed (ISO string)'
    }
  },
  outputFields: {
    venue: {
      type: venueType,
      resolve: response => response.venue
    },
    queued: {
      type: GraphQLBoolean,
      description: 'True when the edit was queued as a Proposal instead of applied directly (Phase 4).',
      resolve: response => !!response.queued
    },
    proposalId: {
      type: GraphQLString,
      description: 'ID of the Proposal created when queued.',
      resolve: response => response.proposalId ?? null
    },
    isCommunityReview: {
      type: GraphQLBoolean,
      description: 'True when the queued proposal routed to community review (Phase 7).',
      resolve: response => !!response.isCommunityReview
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    // Phase 5 TODO: switch to per-field action mapping once trusted-editor scope is wired.
    const decision = await canPerform(ctx.user.id, 'venue.edit_description', {
      kind: 'Venue',
      id: input.venueId
    })
    if (decision.mode === 'denied') {
      return { error: decision.reason || 'Permission denied' }
    }

    try {
      const venue = await VenueModel.findById(input.venueId)
      if (!venue) return { error: 'Venue not found' }

      // Optimistic concurrency check (Phase 3 / Task 22).
      if (input.expectedUpdatedAt) {
        const submitted = new Date(input.expectedUpdatedAt).getTime()
        const current = venue.updatedAt?.getTime() ?? 0
        if (current > submitted) {
          return { error: `STALE_VERSION: record changed at ${venue.updatedAt?.toISOString()}` }
        }
      }

      const updates: Record<string, any> = {}

      if (input.name !== undefined) updates.name = input.name
      if (input.description !== undefined) updates.description = input.description
      if (input.address !== undefined) updates.address = input.address
      if (input.city !== undefined) updates.city = input.city
      if (input.state !== undefined) updates.state = input.state
      if (input.zipCode !== undefined) updates.zipCode = input.zipCode
      if (input.capacity !== undefined && input.capacity !== '') updates.capacity = parseInt(input.capacity, 10) || 0
      if (input.venueType !== undefined) updates.venueType = input.venueType
      if (input.defaultPerformanceType !== undefined) {
        const v = (input.defaultPerformanceType || '').trim()
        if (v === '') {
          updates.defaultPerformanceType = null // explicit unset (mixed-discipline)
        } else if ((PERFORMANCE_TYPES as readonly string[]).includes(v)) {
          updates.defaultPerformanceType = v
        } else {
          return { error: `Invalid defaultPerformanceType "${v}". Must be one of: ${PERFORMANCE_TYPES.join(', ')}` }
        }
      }
      if (input.website !== undefined) updates.website = input.website
      if (input.phone !== undefined) updates.phone = input.phone
      if (input.email !== undefined) updates.email = input.email
      if (input.imageUrl !== undefined && input.imageUrl !== '') updates.imageUrl = input.imageUrl
      if (input.permanentlyClosed !== undefined) updates.permanentlyClosed = input.permanentlyClosed
      if (input.closedDate !== undefined) updates.closedDate = input.closedDate ? new Date(input.closedDate) : null

      const hasCoords =
        typeof input.latitude === 'number' && typeof input.longitude === 'number'

      if (Object.keys(updates).length === 0 && !hasCoords) {
        return { venue }
      }

      if (decision.mode === 'queue') {
        const diff = computeUpdateDiff(venue.toObject(), updates)
        if (Object.keys(diff).length === 0) return { venue }
        const result = await createProposal({
          target: { kind: 'Venue', id: venue._id },
          proposer: { kind: 'User', userId: ctx.user.id, label: ctx.user.username },
          diff,
          submissionVersion: venue.updatedAt,
          isCommunityReview: !!decision.isCommunityReview,
        })
        return { queued: true, proposalId: result.proposalId, venue, isCommunityReview: !!decision.isCommunityReview }
      }

      // Verified coordinates place the pin directly. Applied only on the
      // direct-publish path (derived geo isn't community-reviewable, so it
      // stays out of the proposal diff above) and after it, so it doesn't
      // need to round-trip through the async geocoding queue.
      if (hasCoords) {
        updates.location = {
          type: 'Point',
          coordinates: [input.longitude, input.latitude] // GeoJSON: [lng, lat]
        }
      }

      const oldDoc = venue.toObject()
      const updated = await VenueModel.findByIdAndUpdate(input.venueId, updates, { new: true })
      if (updated) {
        await writeAuditLog({
          target: { kind: 'Venue', id: updated._id },
          author: { kind: 'User', userId: ctx.user.id },
          oldDoc,
          newDoc: updated.toObject(),
          approvalSource: 'direct-publish',
        })
        if (updated.claimedBy?.toString() === ctx.user.id) {
          await bumpForUnit('venue', updated._id)
        }
      }
      return { venue: updated }
    } catch (err) {
      console.error('venueUpdate error:', err)
      return { error: 'Failed to update venue' }
    }
  }
})
