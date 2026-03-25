import { GraphQLFieldConfig, GraphQLString } from 'graphql'
import { PersonConnection } from '../personTypes'
import { PersonModel } from '../personModel'
import { connectionArgs, connectionFromArray } from 'graphql-relay'

export const personList: GraphQLFieldConfig<any, any, any> = {
  type: PersonConnection,
  args: {
    ...connectionArgs,
    search: {
      type: GraphQLString,
      description: 'Search by name'
    }
  },
  resolve: async (_, args) => {
    const { search, ...connArgs } = args
    const filter: any = {}

    if (search) {
      filter.$text = { $search: search }
    }

    try {
      const limit = connArgs.first ?? 100
      const people = await PersonModel.find(filter)
        .sort(search ? { score: { $meta: 'textScore' } } : { name: 1 })
        .limit(limit)
      return connectionFromArray(people, connArgs)
    } catch (error) {
      console.error('Error fetching people:', error)
      return connectionFromArray([], connArgs)
    }
  }
}
