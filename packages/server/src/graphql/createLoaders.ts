import DataLoader from 'dataloader'
import { ShowModel } from '../entities/show/showModel'
import { RunModel } from '../entities/run/runModel'
import { VenueModel } from '../entities/venue/venueModel'
import { PersonModel } from '../entities/person/personModel'
import { UserModel } from '../entities/user/userModel'
import { ProductionCompanyModel } from '../entities/productionCompany/productionCompanyModel'
import { PerformanceModel } from '../entities/performance/performanceModel'
import { StageModel } from '../entities/stage/stageModel'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { CreditModel } from '../entities/credit/creditModel'
import { ShowCreditModel } from '../entities/showCredit/showCreditModel'
import { ListItemModel } from '../entities/list/listItemModel'
import { FollowModel } from '../entities/follow/followModel'
import { ReviewModel } from '../entities/review/reviewModel'
import { WatchlistItemModel } from '../entities/watchlist/watchlistModel'
import { ListModel } from '../entities/list/listModel'
import { CommentModel } from '../entities/comment/commentModel'

// .lean() strips Mongoose virtuals including `id` (which maps _id to id).
// GraphQL's globalIdField relies on `obj.id`, so we restore it on lean results.
function withId(doc: any) {
  if (doc && doc._id && !doc.id) {
    doc.id = doc._id.toString()
  }
  return doc
}

// Helper: create a by-ID loader for any Mongoose model
function createByIdLoader(Model: any) {
  return new DataLoader<string, any>(async (ids) => {
    const docs = await Model.find({ _id: { $in: ids } }).lean()
    const map = new Map(docs.map((d: any) => [d._id.toString(), withId(d)]))
    return ids.map(id => map.get(id.toString()) || null)
  })
}

// Helper: create a by-foreign-key loader that groups results
function createByForeignKeyLoader(Model: any, foreignKey: string, sort?: Record<string, 1 | -1>) {
  return new DataLoader<string, any[]>(async (ids) => {
    let query = Model.find({ [foreignKey]: { $in: ids } })
    if (sort) query = query.sort(sort)
    const docs = await query.lean()
    const map = new Map<string, any[]>()
    for (const doc of docs) {
      withId(doc)
      const key = doc[foreignKey].toString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(doc)
    }
    return ids.map(id => map.get(id.toString()) || [])
  })
}

export function createLoaders() {
  return {
    // === By-ID loaders ===
    showLoader: createByIdLoader(ShowModel),
    runLoader: createByIdLoader(RunModel),
    venueLoader: createByIdLoader(VenueModel),
    personLoader: createByIdLoader(PersonModel),
    userLoader: createByIdLoader(UserModel),
    productionCompanyLoader: createByIdLoader(ProductionCompanyModel),
    performanceLoader: createByIdLoader(PerformanceModel),
    stageLoader: createByIdLoader(StageModel),
    dataSourceLoader: createByIdLoader(DataSourceModel),
    commentLoader: createByIdLoader(CommentModel),
    creditLoader: createByIdLoader(CreditModel),

    // === By-foreign-key loaders ===
    creditsByRunLoader: createByForeignKeyLoader(CreditModel, 'run', { order: 1 }),
    creditsByPersonLoader: createByForeignKeyLoader(CreditModel, 'person', { order: 1 }),
    performancesByRunLoader: createByForeignKeyLoader(PerformanceModel, 'run', { date: 1 }),
    runsByShowLoader: createByForeignKeyLoader(RunModel, 'show', { startDate: -1 }),
    runsByCompanyLoader: createByForeignKeyLoader(RunModel, 'productionCompany', { startDate: -1 }),
    showCreditsByShowLoader: createByForeignKeyLoader(ShowCreditModel, 'show', { order: 1 }),
    showCreditsByPersonLoader: createByForeignKeyLoader(ShowCreditModel, 'person', { order: 1 }),
    stagesByVenueLoader: createByForeignKeyLoader(StageModel, 'venue', { isDefault: 1, name: 1 }),
    listItemsByListLoader: createByForeignKeyLoader(ListItemModel, 'list', { position: 1 }),

    // === Count loaders (batch countDocuments into single aggregation) ===
    followerCountLoader: new DataLoader<string, number>(async (userIds) => {
      const results = await FollowModel.aggregate([
        { $match: { following: { $in: userIds.map(id => id) } } },
        { $group: { _id: '$following', count: { $sum: 1 } } }
      ])
      const map = new Map(results.map((r: any) => [r._id.toString(), r.count]))
      return userIds.map(id => map.get(id.toString()) || 0)
    }),

    followingCountLoader: new DataLoader<string, number>(async (userIds) => {
      const results = await FollowModel.aggregate([
        { $match: { follower: { $in: userIds.map(id => id) } } },
        { $group: { _id: '$follower', count: { $sum: 1 } } }
      ])
      const map = new Map(results.map((r: any) => [r._id.toString(), r.count]))
      return userIds.map(id => map.get(id.toString()) || 0)
    }),

    reviewCountByUserLoader: new DataLoader<string, number>(async (userIds) => {
      const results = await ReviewModel.aggregate([
        { $match: { user: { $in: userIds.map(id => id) } } },
        { $group: { _id: '$user', count: { $sum: 1 } } }
      ])
      const map = new Map(results.map((r: any) => [r._id.toString(), r.count]))
      return userIds.map(id => map.get(id.toString()) || 0)
    }),

    watchlistCountByShowLoader: new DataLoader<string, number>(async (showIds) => {
      const results = await WatchlistItemModel.aggregate([
        { $match: { show: { $in: showIds.map(id => id) } } },
        { $group: { _id: '$show', count: { $sum: 1 } } }
      ])
      const map = new Map(results.map((r: any) => [r._id.toString(), r.count]))
      return showIds.map(id => map.get(id.toString()) || 0)
    }),

    listCountByUserLoader: new DataLoader<string, number>(async (userIds) => {
      const results = await ListModel.aggregate([
        { $match: { owner: { $in: userIds.map(id => id) }, isPublic: true } },
        { $group: { _id: '$owner', count: { $sum: 1 } } }
      ])
      const map = new Map(results.map((r: any) => [r._id.toString(), r.count]))
      return userIds.map(id => map.get(id.toString()) || 0)
    }),
  }
}

export type Loaders = ReturnType<typeof createLoaders>
