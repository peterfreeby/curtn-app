import { GraphQLFieldConfig, GraphQLID, GraphQLNonNull } from 'graphql'
import { fromGlobalId } from 'graphql-relay'
import { listType } from '../listTypes'
import { ListModel } from '../listModel'

export const listById: GraphQLFieldConfig<any, any, { id: string }> = {
  type: listType,
  args: {
    id: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Global ID of the list'
    }
  },
  resolve: async (_, args, ctx) => {
    const { id } = fromGlobalId(args.id)
    const list = await ListModel.findById(id)
    if (!list) return null

    if (!list.isPublic) {
      if (!ctx.user) return null
      const isOwner = String(list.owner) === ctx.user.id
      const isCollaborator = list.collaborators?.some(c => String(c) === ctx.user.id)
      if (!isOwner && !isCollaborator && !ctx.user.isAdmin) return null
    }

    return list
  }
}
