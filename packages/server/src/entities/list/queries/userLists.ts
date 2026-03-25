import { GraphQLFieldConfig, GraphQLID, GraphQLNonNull } from 'graphql'
import { connectionArgs, connectionFromArray, fromGlobalId } from 'graphql-relay'
import { ListConnection } from '../listTypes'
import { ListModel } from '../listModel'

export const userLists: GraphQLFieldConfig<any, any, any> = {
  type: ListConnection,
  args: {
    ...connectionArgs,
    userId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Global ID of the user'
    }
  },
  resolve: async (_, args) => {
    const { userId, ...connArgs } = args

    try {
      const { id } = fromGlobalId(userId)
      const lists = await ListModel.find({
        owner: id,
        isPublic: true
      }).sort({ createdAt: -1 }).limit(100)

      return connectionFromArray(lists, connArgs)
    } catch {
      return connectionFromArray([], connArgs)
    }
  }
}
