import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLNonNull,
  GraphQLString
} from 'graphql'
import { fromGlobalId, mutationWithClientMutationId } from 'graphql-relay'
import { ListModel } from '../listModel'
import { listType } from '../listTypes'
import { errorField } from '../../../graphql/errorField'
import { generateListSlug } from '../slugify'

export const listUpdate = mutationWithClientMutationId({
  name: 'listUpdate',
  description: 'Update list metadata (owner only)',
  inputFields: {
    listId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Global ID of the list'
    },
    name: {
      type: GraphQLString
    },
    description: {
      type: GraphQLString
    },
    isPublic: {
      type: GraphQLBoolean
    }
  },
  outputFields: {
    list: {
      type: listType,
      resolve: response => response.list
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ listId, name, description, isPublic }, ctx) => {
    if (!ctx.user) {
      return { list: null, error: 'Unauthorized' }
    }

    const { id } = fromGlobalId(listId)
    const list = await ListModel.findById(id)

    if (!list) {
      return { list: null, error: 'List not found' }
    }

    if (String(list.owner) !== ctx.user.id) {
      return { list: null, error: 'Only the list owner can update it' }
    }

    if (name !== undefined && name !== null) {
      list.name = name
      list.slug = await generateListSlug(name, ctx.user.id)
    }
    if (description !== undefined && description !== null) {
      list.description = description
    }
    if (isPublic !== undefined && isPublic !== null) {
      list.isPublic = isPublic
    }

    await list.save()
    return { list }
  }
})
