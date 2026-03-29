import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { userType } from '../userTypes'
import { UserModel } from '../userModel'
import { PersonModel } from '../../person/personModel'

export const userUnclaimPerson = mutationWithClientMutationId({
  name: 'userUnclaimPerson',
  description: 'Unlink the current user from their claimed Person entity',
  inputFields: {},
  mutateAndGetPayload: async (_: any, ctx: any) => {
    if (!ctx.user) {
      return { error: 'Authentication required' }
    }

    const user = await UserModel.findById(ctx.user.id)
    if (!user) {
      return { error: 'User not found' }
    }

    if (!user.personId) {
      return { error: 'You have not claimed a person' }
    }

    // Clear bidirectional link
    const person = await PersonModel.findById(user.personId)
    if (person) {
      person.userId = undefined
      await person.save()
    }

    user.personId = undefined
    await user.save()

    return { user }
  },
  outputFields: {
    ...errorField,
    user: {
      type: userType,
      resolve: (response: any) => response.user
    }
  }
})
