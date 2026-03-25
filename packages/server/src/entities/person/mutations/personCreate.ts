import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { personType } from '../personTypes'
import { PersonModel } from '../personModel'
import { errorField } from '../../../graphql/errorField'

export const personCreate = mutationWithClientMutationId({
  name: 'personCreate',
  description: 'Create a new person (find-or-create by slug)',
  inputFields: {
    name: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Person name'
    },
    bio: {
      type: GraphQLString,
      description: 'Short bio'
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
    if (!ctx.user) {
      return { error: 'Unauthorized', person: null }
    }

    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    const existing = await PersonModel.findOne({ slug })
    if (existing) {
      return { person: existing }
    }

    try {
      const person = await new PersonModel({
        name: input.name,
        slug,
        bio: input.bio,
        submittedBy: ctx.user.id
      }).save()

      return { person }
    } catch {
      return { error: 'Failed to create person' }
    }
  }
})
