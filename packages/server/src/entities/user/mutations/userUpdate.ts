import {
  GraphQLString,
  GraphQLNonNull
} from 'graphql'
import { UserModel } from '../userModel'
import { mutationWithClientMutationId } from 'graphql-relay'
import { userType } from '../userTypes'
import { errorField } from '../../../graphql/errorField'

export const userUpdate = mutationWithClientMutationId({
  name: 'userUpdate',
  description: 'Update the authenticated user\'s profile',
  inputFields: {
    fullName: {
      type: GraphQLString,
      description: `User's full name`
    },
    username: {
      type: GraphQLString,
      description: `User's username`
    },
    email: {
      type: GraphQLString,
      description: `User's email`
    }
  },
  outputFields: {
    user: {
      type: userType,
      resolve: response => response.user
    },
    ...errorField
  },
  mutateAndGetPayload: async (updates, ctx) => {
    if (!ctx.user) {
      return { error: 'Unauthorized' }
    }

    if (updates.username) {
      const existing = await UserModel.findOne({ username: updates.username })

      if (existing && existing._id.toString() !== ctx.user._id.toString()) {
        return { error: 'Username is already taken' }
      }
    }

    try {
      const user = await UserModel.findByIdAndUpdate(
        ctx.user._id,
        { $set: updates },
        { new: true }
      )

      if (!user) {
        return { error: 'User not found' }
      }

      return { user }
    } catch (error: unknown) {
      return { error: (error as Error).message }
    }
  }
})
