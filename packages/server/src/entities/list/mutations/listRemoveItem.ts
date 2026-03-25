import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLNonNull
} from 'graphql'
import { fromGlobalId, mutationWithClientMutationId } from 'graphql-relay'
import { ListModel } from '../listModel'
import { ListItemModel } from '../listItemModel'
import { errorField } from '../../../graphql/errorField'

export const listRemoveItem = mutationWithClientMutationId({
  name: 'listRemoveItem',
  description: 'Remove an item from a list (owner or collaborator)',
  inputFields: {
    listId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Global ID of the list'
    },
    itemId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Global ID of the entity to remove'
    }
  },
  outputFields: {
    success: {
      type: GraphQLBoolean,
      resolve: response => response.success
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ listId, itemId }, ctx) => {
    if (!ctx.user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { id: listObjectId } = fromGlobalId(listId)
    const list = await ListModel.findById(listObjectId)

    if (!list) {
      return { success: false, error: 'List not found' }
    }

    const isOwner = String(list.owner) === ctx.user.id
    const isCollaborator = list.collaborators?.some(c => String(c) === ctx.user.id)
    if (!isOwner && !isCollaborator) {
      return { success: false, error: 'You do not have edit access to this list' }
    }

    const { id: targetItemId } = fromGlobalId(itemId)

    const deleted = await ListItemModel.findOneAndDelete({ list: list._id, itemId: targetItemId })
    if (!deleted) {
      return { success: false, error: 'Item not found in this list' }
    }

    await ListModel.findByIdAndUpdate(list._id, { $inc: { itemCount: -1 } })

    return { success: true }
  }
})
