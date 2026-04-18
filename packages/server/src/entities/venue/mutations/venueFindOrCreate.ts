import { GraphQLNonNull, GraphQLString, GraphQLFloat, GraphQLBoolean } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { venueType } from '../venueTypes'
import { VenueModel } from '../venueModel'
import { ReviewModel } from '../../review/reviewModel'
import { errorField } from '../../../graphql/errorField'

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const venueFindOrCreate = mutationWithClientMutationId({
  name: 'venueFindOrCreate',
  description: 'Find an existing venue by name or create a new one',
  inputFields: {
    name: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Venue name (case-insensitive match)'
    },
    address: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Street address'
    },
    city: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'City (NYC, Minneapolis, LA)'
    },
    state: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'State (NY, MN, CA)'
    },
    latitude: {
      type: new GraphQLNonNull(GraphQLFloat),
      description: 'Latitude coordinate'
    },
    longitude: {
      type: new GraphQLNonNull(GraphQLFloat),
      description: 'Longitude coordinate'
    },
    venueType: {
      type: GraphQLString,
      description: 'Venue type (default: theater)'
    },
    website: {
      type: GraphQLString,
      description: 'Website URL'
    }
  },
  outputFields: {
    venue: {
      type: venueType,
      resolve: response => response.venue
    },
    created: {
      type: GraphQLBoolean,
      resolve: response => response.created
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) {
      return { error: 'Unauthorized', venue: null, created: false }
    }

    try {
      const escaped = escapeRegex(input.name.trim())
      const existing = await VenueModel.findOne({
        name: { $regex: new RegExp(`^${escaped}$`, 'i') }
      })

      if (existing) {
        return { venue: existing, created: false }
      }

      const name = input.name.trim()
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

      const trimmedAddress = input.address.trim()

      const venue = await new VenueModel({
        name,
        slug,
        address: trimmedAddress,
        city: input.city,
        state: input.state,
        coordinates: {
          lat: input.latitude,
          lng: input.longitude
        },
        venueType: input.venueType || 'theater',
        website: input.website,
        verificationStatus: 'community',
        submittedBy: ctx.user.id
      }).save()

      return { venue, created: true }
    } catch (err) {
      console.error('venueFindOrCreate error:', err)
      return { error: 'Failed to find or create venue' }
    }
  }
})
