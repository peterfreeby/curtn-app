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
      type: GraphQLString,
      description: 'Street address (optional — omit for a name-only stub to be verified later)'
    },
    city: {
      type: GraphQLString,
      description: 'City (NYC, Minneapolis, LA)'
    },
    state: {
      type: GraphQLString,
      description: 'State (NY, MN, CA)'
    },
    latitude: {
      type: GraphQLFloat,
      description: 'Latitude coordinate (set with longitude to place the pin)'
    },
    longitude: {
      type: GraphQLFloat,
      description: 'Longitude coordinate (set with latitude to place the pin)'
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

      // Build only the fields actually supplied. A name-only stub gets no
      // address and no location — avoiding the old "TBD / NYC default pin"
      // garbage. Coordinates are written only when both are present, and the
      // address is verified at edit time.
      const venueDoc: Record<string, any> = {
        name,
        slug,
        venueType: input.venueType || 'theater',
        website: input.website,
        verificationStatus: 'community',
        submittedBy: ctx.user.id
      }
      const trimmedAddress = input.address?.trim()
      if (trimmedAddress) venueDoc.address = trimmedAddress
      if (input.city) venueDoc.city = input.city
      if (input.state) venueDoc.state = input.state
      if (typeof input.latitude === 'number' && typeof input.longitude === 'number') {
        venueDoc.location = {
          type: 'Point',
          coordinates: [input.longitude, input.latitude]
        }
      }

      const venue = await new VenueModel(venueDoc).save()

      return { venue, created: true }
    } catch (err) {
      console.error('venueFindOrCreate error:', err)
      return { error: 'Failed to find or create venue' }
    }
  }
})
