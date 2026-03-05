import {
  GraphQLObjectType
} from 'graphql'

import { userMutations } from '../entities/user/mutations/user'
import { reviewMutations } from '../entities/review/mutations/review'
import { commentMutations } from '../entities/comment/mutations/comment'
import { followMutations } from '../entities/follow/mutations/follow'
import { creditMutations } from '../entities/credit/mutations/credit'
import { productionCompanyMutations } from '../entities/productionCompany/mutations/productionCompany'
import { showMutations } from '../entities/show/mutations/show'
import { runMutations } from '../entities/run/mutations/run'
import { performanceMutations } from '../entities/performance/mutations/performance'
import { watchlistMutations } from '../entities/watchlist/mutations/watchlist'

export const mutation = new GraphQLObjectType({
  name: 'Mutation',
  description: 'The root mutation type',
  fields: {
    ...userMutations,
    ...commentMutations,
    ...reviewMutations,
    ...followMutations,
    ...creditMutations,
    ...productionCompanyMutations,
    ...showMutations,
    ...runMutations,
    ...performanceMutations,
    ...watchlistMutations
  }
})
