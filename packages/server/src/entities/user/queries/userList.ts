import { GraphQLFieldConfig, GraphQLFieldConfigArgumentMap, GraphQLString } from 'graphql'
import { UserConnection } from '../userTypes'
import { UserModel } from '../userModel'
import { connectionArgs, connectionFromArray } from 'graphql-relay'
import { applyCursorToAggregate, buildConnection } from '../../../graphql/cursorPagination'

type Args = GraphQLFieldConfigArgumentMap & {
  username?: string
  email?: string
}

export const userList: GraphQLFieldConfig<any, any, Args> = {
  type: UserConnection,
  args: {
    ...connectionArgs,
    username: {
      type: GraphQLString,
      description: 'Filter users by this username'
    },
    email: {
      type: GraphQLString,
      description: 'Filter users by this email'
    }
  },
  resolve: async (_, args) => {
    const { username, email, ...connectionArgs } = args

    const filter = {
      ...(username && { username }),
      ...(email && { email })
    }

    const pipeline = applyCursorToAggregate(
      [{ $match: filter }],
      { after: (connectionArgs as any).after, first: (connectionArgs as any).first, sortField: 'createdAt', sortDirection: -1, maxLimit: 200 }
    )
    const users = await UserModel.aggregate(pipeline)
    return buildConnection(users, { first: (connectionArgs as any).first, sortField: 'createdAt', maxLimit: 200 })
  }
}
