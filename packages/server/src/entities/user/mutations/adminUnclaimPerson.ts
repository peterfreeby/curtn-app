import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { PersonModel } from '../../person/personModel'
import { UserModel } from '../userModel'

export const adminUnclaimPerson = mutationWithClientMutationId({
  name: 'adminUnclaimPerson',
  description: 'Break the link between a User and a Person (admin only)',
  inputFields: {
    personId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the Person to unclaim'
    }
  },
  mutateAndGetPayload: async ({ personId }: { personId: string }, ctx: any) => {
    if (!ctx.user) return { error: 'Authentication required' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    const person = await PersonModel.findById(personId)
    if (!person) return { error: 'Person not found' }
    if (!person.userId) return { error: 'This person is not claimed' }

    const user = await UserModel.findById(person.userId)
    if (user) {
      user.personId = undefined
      await user.save()
    }

    person.userId = undefined
    await person.save()

    return { success: true }
  },
  outputFields: {
    ...errorField,
    success: {
      type: GraphQLString,
      resolve: (response: any) => response.success ? 'Person unclaimed successfully' : null
    }
  }
})
