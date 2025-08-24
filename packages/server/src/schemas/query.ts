import { GraphQLObjectType } from 'graphql'
// import { movieQueries } from '../entities/movie/queries/queries' // Commented out - replaced with performances
import { personQueries } from '../entities/person/queries/queries'
import { userQueries } from '../entities/user/queries/queries'
import { reviewQueries } from '../entities/review/queries/queries'
import { performanceQueries } from '../entities/performance/queries/queries' // New performance queries
import { venueQueries } from '../entities/venue/queries/queries' // New venue queries
import { nodeField, nodesField } from '../graphql/nodeInterface'

export const query = new GraphQLObjectType({
  name: 'Query',
  description: 'The root query type',
  fields: () => ({
    // ...movieQueries, // Commented out - replaced with performances
    ...performanceQueries, // New performance queries
    ...venueQueries, // New venue queries
    ...personQueries,
    ...userQueries,
    ...reviewQueries,
    node: nodeField,
    nodes: nodesField
  })
})