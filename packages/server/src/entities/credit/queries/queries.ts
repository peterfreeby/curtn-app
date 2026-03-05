import { GraphQLFieldConfig, GraphQLID, GraphQLList, GraphQLNonNull, GraphQLString } from 'graphql'
import { creditType } from '../creditType'
import { CreditModel } from '../creditModel'
import { fromGlobalId } from 'graphql-relay'

export const creditsByRun: GraphQLFieldConfig<any, any, any> = {
  type: new GraphQLList(creditType),
  args: {
    runId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Run ID'
    },
    creditType: {
      type: GraphQLString,
      description: 'Filter by credit type (cast or crew)'
    }
  },
  resolve: async (_, args) => {
    try {
      const { id } = fromGlobalId(args.runId)
      const filter: any = { run: id }
      if (args.creditType) {
        filter.creditType = args.creditType
      }
      return await CreditModel.find(filter).sort({ order: 1 })
    } catch {
      return []
    }
  }
}

export const creditsByPerson: GraphQLFieldConfig<any, any, { personId: string }> = {
  type: new GraphQLList(creditType),
  args: {
    personId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Person ID'
    }
  },
  resolve: async (_, args) => {
    try {
      const { id } = fromGlobalId(args.personId)
      return await CreditModel.find({ person: id }).sort({ createdAt: -1 })
    } catch {
      return []
    }
  }
}

export const creditQueries = {
  creditsByRun,
  creditsByPerson
}
