import { GraphQLObjectType } from 'graphql'
import { personQueries } from '../entities/person/queries/queries'
import { userQueries } from '../entities/user/queries/queries'
import { reviewQueries } from '../entities/review/queries/queries'
import { performanceQueries } from '../entities/performance/queries/queries'
import { venueQueries } from '../entities/venue/queries/queries'
import { followQueries } from '../entities/follow/queries/queries'
import { showQueries } from '../entities/show/queries/queries'
import { runQueries } from '../entities/run/queries/queries'
import { productionCompanyQueries } from '../entities/productionCompany/queries/queries'
import { creditQueries } from '../entities/credit/queries/queries'
import { watchlistQueries } from '../entities/watchlist/queries/queries'
import { nodeField, nodesField } from '../graphql/nodeInterface'

export const query = new GraphQLObjectType({
  name: 'Query',
  description: 'The root query type',
  fields: () => ({
    ...performanceQueries,
    ...venueQueries,
    ...personQueries,
    ...userQueries,
    ...reviewQueries,
    ...followQueries,
    ...showQueries,
    ...runQueries,
    ...productionCompanyQueries,
    ...creditQueries,
    ...watchlistQueries,
    node: nodeField,
    nodes: nodesField
  })
})
