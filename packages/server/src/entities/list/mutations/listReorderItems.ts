import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull
} from 'graphql'
import { fromGlobalId, mutationWithClientMutationId } from 'graphql-relay'
import { ListModel } from '../listModel'
import { ListItemModel } from '../listItemModel'
import { errorField } from '../../../graphql/errorField'

export const listReorderItems = mutationWithClientMutationId({
  name: 'listReorderItems',
  description: 'Reorder items in a list (owner or collaborator)',
  inputFields: {
    listId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Global ID of the list'
    },
    itemIds: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLID))),
      description: 'Ordered array of ListItem global IDs'
    }
  },
  outputFields: {
    success: {
      type: GraphQLBoolean,
      resolve: response => response.success
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ listId, itemIds }, ctx) => {
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

    const updates = itemIds.map((globalId: string, index: number) => {
      const { id } = fromGlobalId(globalId)
      return ListItemModel.updateOne(
        { _id: id, list: list._id },
        { position: index }
      )
    })

    await Promise.all(updates)

    return { success: true }
  }
})
