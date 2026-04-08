import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { userType } from '../userTypes'
import { UserModel } from '../userModel'
import { errorField } from '../../../graphql/errorField'

export const createProfile = mutationWithClientMutationId({
  name: 'createProfile',
  description: 'Complete onboarding by setting username and full name. Requires authentication.',
  inputFields: {
    username: {
      type: new GraphQLNonNull(GraphQLString),
      description: `User's chosen username`
    },
    fullName: {
      type: new GraphQLNonNull(GraphQLString),
      description: `User's full name`
    }
  },
  outputFields: {
    user: {
      type: userType,
      resolve: response => response.user
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ username, fullName }, ctx) => {
    if (!ctx.user) {
      return { error: 'Unauthorized' }
    }

    const existingUsername = await UserModel.findOne({ username })

    if (existingUsername && existingUsername._id.toString() !== ctx.user._id.toString()) {
      return { error: 'Username is already taken' }
    }

    try {
      const user = await UserModel.findByIdAndUpdate(
        ctx.user._id,
        { username, fullName },
        { new: true }
      )

      return { user }
    } catch (error: unknown) {
      return { error: (error as Error).message }
    }
  }
})
