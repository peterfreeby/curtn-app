import {
  GraphQLInt,
  GraphQLNonNull,
  GraphQLString
} from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { showCreditType } from '../showCreditTypes'
import { ShowCreditModel } from '../showCreditModel'
import { PersonModel } from '../../person/personModel'
import { errorField } from '../../../graphql/errorField'

export const showCreditCreate = mutationWithClientMutationId({
  name: 'showCreditCreate',
  description: 'Create a credit linking a person to a show (e.g. Playwright, Composer)',
  inputFields: {
    showId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Show MongoDB ObjectId'
    },
    personName: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Person name (find-or-create by slug)'
    },
    role: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Role (e.g. "Playwright", "Composer", "Lyricist", "Choreographer", "Librettist")'
    },
    order: {
      type: GraphQLInt,
      description: 'Display order (default 0)'
    }
  },
  outputFields: {
    showCredit: {
      type: showCreditType,
      resolve: response => response.showCredit
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) {
      return { error: 'Unauthorized', showCredit: null }
    }

    const slug = input.personName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    let person = await PersonModel.findOne({ slug })
    if (!person) {
      person = await new PersonModel({
        name: input.personName,
        slug,
        submittedBy: ctx.user.id
      }).save()
    }

    try {
      const showCredit = await new ShowCreditModel({
        person: person._id,
        show: input.showId,
        role: input.role,
        order: input.order || 0,
        submittedBy: ctx.user.id
      }).save()

      return { showCredit }
    } catch {
      return { error: 'Failed to create show credit (may already exist)' }
    }
  }
})
