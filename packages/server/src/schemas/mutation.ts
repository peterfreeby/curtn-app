import {
  GraphQLObjectType
} from 'graphql'

import { userMutations } from '../entities/user/mutations/user'
import { reviewMutations } from '../entities/review/mutations/review'
import { commentMutations } from '../entities/comment/mutations/comment'
import { followMutations } from '../entities/follow/mutations/follow'
import { creditMutations } from '../entities/credit/mutations/credit'
import { showCreditMutations } from '../entities/showCredit/mutations/showCredit'
import { showCompanyCreditMutations } from '../entities/showCompanyCredit/mutations/showCompanyCredit'
import { productionCompanyMutations } from '../entities/productionCompany/mutations/productionCompany'
import { showMutations } from '../entities/show/mutations/show'
import { runMutations } from '../entities/run/mutations/run'
import { performanceMutations } from '../entities/performance/mutations/performance'
import { watchlistMutations } from '../entities/watchlist/mutations/watchlist'
import { dataSourceMutations } from '../entities/dataSource/mutations/dataSource'
import { pendingImportMutations } from '../entities/pendingImport/mutations/pendingImport'
import { venueMutations } from '../entities/venue/mutations/venue'
import { personMutations } from '../entities/person/mutations/person'
import { listMutations } from '../entities/list/mutations/list'
import { claimRequestMutations } from '../entities/claimRequest/mutations/claimRequest'
import { seenMutations } from '../entities/seen/mutations/seen'
import { notificationMutations } from '../entities/notification/mutations/notification'
import { claimTransferMutations } from '../entities/claimTransfer/mutations/claimTransfer'

export const mutation = new GraphQLObjectType({
  name: 'Mutation',
  description: 'The root mutation type',
  fields: {
    ...userMutations,
    ...commentMutations,
    ...reviewMutations,
    ...followMutations,
    ...creditMutations,
    ...showCreditMutations,
    ...showCompanyCreditMutations,
    ...productionCompanyMutations,
    ...showMutations,
    ...runMutations,
    ...performanceMutations,
    ...watchlistMutations,
    ...dataSourceMutations,
    ...pendingImportMutations,
    ...venueMutations,
    ...personMutations,
    ...listMutations,
    ...claimRequestMutations,
    ...seenMutations,
    ...notificationMutations,
    ...claimTransferMutations
  }
})
