import { GraphQLBoolean, GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { venueType } from '../venueTypes'
import { VenueModel } from '../venueModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'

export const venueUpdate = mutationWithClientMutationId({
  name: 'venueUpdate',
  description: 'Update an existing venue (admin only)',
  inputFields: {
    venueId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the venue to update'
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
    capacity: {
      type: GraphQLString,
      description: 'Seating capacity (string, parsed to int)'
    },
    venueType: {
      type: GraphQLString,
      description: 'Type of venue (theater, comedy-club, etc.)'
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
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    try {
      const venue = await VenueModel.findById(input.venueId)
      if (!venue) return { error: 'Venue not found' }

      const updates: Record<string, any> = {}

      if (input.name !== undefined) updates.name = input.name
      if (input.description !== undefined) updates.description = input.description
      if (input.address !== undefined) updates.address = input.address
      if (input.city !== undefined) updates.city = input.city
      if (input.state !== undefined) updates.state = input.state
      if (input.zipCode !== undefined) updates.zipCode = input.zipCode
      if (input.capacity !== undefined && input.capacity !== '') updates.capacity = parseInt(input.capacity, 10) || 0
      if (input.venueType !== undefined) updates.venueType = input.venueType
      if (input.website !== undefined) updates.website = input.website
      if (input.phone !== undefined) updates.phone = input.phone
      if (input.email !== undefined) updates.email = input.email
      if (input.imageUrl !== undefined && input.imageUrl !== '') updates.imageUrl = input.imageUrl
      if (input.permanentlyClosed !== undefined) updates.permanentlyClosed = input.permanentlyClosed
      if (input.closedDate !== undefined) updates.closedDate = input.closedDate ? new Date(input.closedDate) : null

      if (Object.keys(updates).length === 0) {
        return { venue }
      }

      const updated = await VenueModel.findByIdAndUpdate(input.venueId, updates, { new: true })
      return { venue: updated }
    } catch (err) {
      console.error('venueUpdate error:', err)
      return { error: 'Failed to update venue' }
    }
  }
})
