import {
  GraphQLID,
  GraphQLNonNull
} from 'graphql'
import { fromGlobalId, mutationWithClientMutationId } from 'graphql-relay'
import { ListModel } from '../listModel'
import { listType } from '../listTypes'
import { errorField } from '../../../graphql/errorField'

export const listRemoveCollaborator = mutationWithClientMutationId({
  name: 'listRemoveCollaborator',
  description: 'Remove a collaborator from a list (owner only)',
  inputFields: {
    listId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Global ID of the list'
    },
    userId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Global ID of the user to remove'
    }
  },
  outputFields: {
    list: {
      type: listType,
      resolve: response => response.list
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ listId, userId }, ctx) => {
    if (!ctx.user) {
      return { list: null, error: 'Unauthorized' }
    }

    const { id: listObjectId } = fromGlobalId(listId)
    const list = await ListModel.findById(listObjectId)

    if (!list) {
      return { list: null, error: 'List not found' }
    }

    if (String(list.owner) !== ctx.user.id) {
      return { list: null, error: 'Only the list owner can remove collaborators' }
    }

    const { id: targetUserId } = fromGlobalId(userId)

    await ListModel.findByIdAndUpdate(list._id, {
      $pull: { collaborators: targetUserId }
    })

    return { list: await ListModel.findById(list._id) }
  }
})
