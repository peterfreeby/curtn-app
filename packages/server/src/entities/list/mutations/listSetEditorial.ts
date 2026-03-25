import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLInt,
  GraphQLNonNull
} from 'graphql'
import { fromGlobalId, mutationWithClientMutationId } from 'graphql-relay'
import { ListModel } from '../listModel'
import { listType } from '../listTypes'
import { errorField } from '../../../graphql/errorField'

export const listSetEditorial = mutationWithClientMutationId({
  name: 'listSetEditorial',
  description: 'Set a list as editorial for the browse page (admin only)',
  inputFields: {
    listId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Global ID of the list'
    },
    isEditorial: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: 'Whether this list should appear on the browse page'
    },
    isActive: {
      type: GraphQLBoolean,
      description: 'Whether this editorial list is currently visible on the browse page'
    },
    displayOrder: {
      type: GraphQLInt,
      description: 'Sort order on the browse page (lower = first)'
    }
  },
  outputFields: {
    list: {
      type: listType,
      resolve: response => response.list
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ listId, isEditorial, isActive, displayOrder }, ctx) => {
    if (!ctx.user) {
      return { list: null, error: 'Unauthorized' }
    }

    if (!ctx.user.isAdmin) {
      return { list: null, error: 'Admin access required' }
    }

    const { id } = fromGlobalId(listId)
    const update: any = { isEditorial }
    if (isActive !== undefined && isActive !== null) {
      update.isActive = isActive
    }
    if (displayOrder !== undefined && displayOrder !== null) {
      update.displayOrder = displayOrder
    }

    const list = await ListModel.findByIdAndUpdate(id, update, { new: true })

    if (!list) {
      return { list: null, error: 'List not found' }
    }

    return { list }
  }
})
