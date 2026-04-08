import { GraphQLNonNull, GraphQLString, GraphQLBoolean } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { userType } from '../userTypes'
import { UserModel } from '../userModel'
import { firebaseAuth } from '../../../firebase/admin'
import { errorField } from '../../../graphql/errorField'

export const authenticateWithPhone = mutationWithClientMutationId({
  name: 'authenticateWithPhone',
  description: 'Verify a Firebase ID token from phone auth. Finds or creates the user.',
  inputFields: {
    idToken: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Firebase ID token from client-side phone authentication'
    }
  },
  outputFields: {
    user: {
      type: userType,
      resolve: response => response.user
    },
    isNewUser: {
      type: GraphQLBoolean,
      resolve: response => response.isNewUser
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ idToken }) => {
    try {
      const decoded = await firebaseAuth.verifyIdToken(idToken)
      const { uid, phone_number } = decoded

      if (!phone_number) {
        return { error: 'No phone number associated with this token' }
      }

      let user = await UserModel.findOne({ firebaseUid: uid })

      if (user) {
        return { user, isNewUser: false }
      }

      user = await new UserModel({
        firebaseUid: uid,
        phoneNumber: phone_number
      }).save()

      return { user, isNewUser: true }
    } catch (error: unknown) {
      return { error: (error as Error).message }
    }
  }
})
