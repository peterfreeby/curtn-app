import { GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { userType } from '../userTypes'
import { UserModel } from '../userModel'
import { errorField } from '../../../graphql/errorField'

export const userProfileUpdate = mutationWithClientMutationId({
  name: 'userProfileUpdate',
  description: 'Update the current user\'s profile details',
  inputFields: {
    fullName: {
      type: GraphQLString,
      description: 'Display name'
    },
    bio: {
      type: GraphQLString,
      description: 'Short bio'
    },
    avatarUrl: {
      type: GraphQLString,
      description: 'Avatar image URL (from Vercel Blob)'
    }
  },
  outputFields: {
    user: {
      type: userType,
      resolve: response => response.user
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    try {
      const updates: Record<string, any> = {}

      if (input.fullName !== undefined && input.fullName.trim() !== '') {
        updates.fullName = input.fullName.trim()
      }
      if (input.bio !== undefined) updates.bio = input.bio
      if (input.avatarUrl !== undefined && input.avatarUrl !== '') {
        updates.avatarUrl = input.avatarUrl
      }

      if (Object.keys(updates).length === 0) {
        const user = await UserModel.findById(ctx.user.id)
        return { user }
      }

      const updated = await UserModel.findByIdAndUpdate(ctx.user.id, updates, { new: true })
      return { user: updated }
    } catch (err) {
      console.error('userProfileUpdate error:', err)
      return { error: 'Failed to update profile' }
    }
  }
})
