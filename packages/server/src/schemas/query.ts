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
import { showCreditQueries } from '../entities/showCredit/queries/queries'
import { showCompanyCreditQueries } from '../entities/showCompanyCredit/queries/queries'
import { watchlistQueries } from '../entities/watchlist/queries/queries'
import { dataSourceQueries } from '../entities/dataSource/queries/queries'
import { stageQueries } from '../entities/stage/queries/queries'
import { pendingImportQueries } from '../entities/pendingImport/queries/queries'
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
    ...showCreditQueries,
    ...showCompanyCreditQueries,
    ...watchlistQueries,
    ...dataSourceQueries,
    ...stageQueries,
    ...pendingImportQueries,
    node: nodeField,
    nodes: nodesField
  })
})
