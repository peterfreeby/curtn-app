import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { personType } from '../personTypes'
import { PersonModel } from '../personModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'

export const personUpdate = mutationWithClientMutationId({
  name: 'personUpdate',
  description: 'Update an existing person (admin or claimed owner)',
  inputFields: {
    personId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the person to update'
    },
    name: {
      type: GraphQLString,
      description: 'Person name'
    },
    bio: {
      type: GraphQLString,
      description: 'Biography'
    },
    headshotUrl: {
      type: GraphQLString,
      description: 'Headshot image URL (from Vercel Blob)'
    },
    wikidataId: {
      type: GraphQLString,
      description: 'Wikidata ID'
    }
  },
  outputFields: {
    person: {
      type: personType,
      resolve: response => response.person
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    try {
      const currentUser = await UserModel.findById(ctx.user.id)
      if (!currentUser) return { error: 'User not found' }

      const person = await PersonModel.findById(input.personId)
      if (!person) return { error: 'Person not found' }

      const isAdmin = !!currentUser.isAdmin
      const isClaimOwner = person.userId && person.userId.toString() === ctx.user.id
      if (!isAdmin && !isClaimOwner) return { error: 'Admin access or claimed ownership required' }

      const updates: Record<string, any> = {}

      if (input.name !== undefined) {
        updates.name = input.name
        // Regenerate slug when name changes
        updates.slug = input.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      }
      if (input.bio !== undefined) updates.bio = input.bio
      if (input.headshotUrl !== undefined && input.headshotUrl !== '') updates.headshotUrl = input.headshotUrl
      if (input.wikidataId !== undefined) updates.wikidataId = input.wikidataId

      if (Object.keys(updates).length === 0) {
        return { person }
      }

      const updated = await PersonModel.findByIdAndUpdate(input.personId, updates, { new: true })
      return { person: updated }
    } catch (err) {
      console.error('personUpdate error:', err)
      return { error: 'Failed to update person' }
    }
  }
})
