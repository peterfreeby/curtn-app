import { GraphQLFieldConfig, GraphQLID, GraphQLNonNull, GraphQLString } from 'graphql'
import { personType, PersonConnection } from '../personTypes'
import { PersonModel } from '../personModel'
import { connectionArgs, connectionFromArray, fromGlobalId } from 'graphql-relay'
import { personList } from './personList'

export const singlePerson: GraphQLFieldConfig<any, any, { id: string }> = {
  type: personType,
  args: {
    id: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Person ID'
    }
  },
  resolve: async (_, args) => {
    try {
      const { id } = fromGlobalId(args.id)
      return await PersonModel.findById(id)
    } catch {
      return null
    }
  }
}

export const personBySlug: GraphQLFieldConfig<any, any, { slug: string }> = {
  type: personType,
  args: {
    slug: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Person slug'
    }
  },
  resolve: async (_, args) => {
    try {
      return await PersonModel.findOne({ slug: args.slug })
    } catch {
      return null
    }
  }
}

export const personQueries = {
  singlePerson,
  personBySlug,
  personList
}
