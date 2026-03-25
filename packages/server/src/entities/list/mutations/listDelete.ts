import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLNonNull
} from 'graphql'
import { fromGlobalId, mutationWithClientMutationId } from 'graphql-relay'
import { ListModel } from '../listModel'
import { ListItemModel } from '../listItemModel'
import { errorField } from '../../../graphql/errorField'

export const listDelete = mutationWithClientMutationId({
  name: 'listDelete',
  description: 'Delete a list and all its items (owner or admin only)',
  inputFields: {
    listId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Global ID of the list'
    }
  },
  outputFields: {
    success: {
      type: GraphQLBoolean,
      resolve: response => response.success
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ listId }, ctx) => {
    if (!ctx.user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { id } = fromGlobalId(listId)
    const list = await ListModel.findById(id)

    if (!list) {
      return { success: false, error: 'List not found' }
    }

    const isOwner = String(list.owner) === ctx.user.id
    if (!isOwner && !ctx.user.isAdmin) {
      return { success: false, error: 'Only the list owner or an admin can delete it' }
    }

    await ListItemModel.deleteMany({ list: list._id })
    await ListModel.findByIdAndDelete(list._id)

    return { success: true }
  }
})
