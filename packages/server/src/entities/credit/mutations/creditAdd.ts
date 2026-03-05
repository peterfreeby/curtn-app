import {
  GraphQLID,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLString
} from 'graphql'
import { fromGlobalId, mutationWithClientMutationId } from 'graphql-relay'
import { creditType } from '../creditType'
import { CreditModel } from '../creditModel'
import { PersonModel } from '../../person/personModel'
import { errorField } from '../../../graphql/errorField'

export const creditAdd = mutationWithClientMutationId({
  name: 'creditAdd',
  description: 'Add a credit (cast/crew) to a run',
  inputFields: {
    personId: {
      type: GraphQLID,
      description: 'Existing person ID (provide this OR personName)'
    },
    personName: {
      type: GraphQLString,
      description: 'New person name (auto-creates Person if no match)'
    },
    runId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Run to attach credit to'
    },
    creditType: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'cast or crew'
    },
    role: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Role name (e.g. "Hamlet", "Director")'
    },
    order: {
      type: GraphQLInt,
      description: 'Billing order (default 0)'
    }
  },
  outputFields: {
    credit: {
      type: creditType,
      resolve: response => response.credit
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) {
      return { error: 'Unauthorized', credit: null }
    }

    const runId = fromGlobalId(input.runId).id

    let personId: string
    if (input.personId) {
      personId = fromGlobalId(input.personId).id
    } else if (input.personName) {
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
      personId = person._id.toString()
    } else {
      return { error: 'Either personId or personName is required', credit: null }
    }

    try {
      const credit = await new CreditModel({
        person: personId,
        run: runId,
        creditType: input.creditType,
        role: input.role,
        order: input.order || 0,
        submittedBy: ctx.user.id
      }).save()

      return { credit }
    } catch {
      return { error: 'Failed to create credit (may already exist)' }
    }
  }
})
