import mongoose, { Schema, Types } from 'mongoose'

export const LIST_TYPES = ['shows', 'venues', 'runs', 'performances', 'people'] as const
export type ListType = typeof LIST_TYPES[number]

// How a list's items are populated:
//  - manual:   hand-picked ListItem docs (the original behavior)
//  - entity:   auto — all shows from one venue/person/company, by recency
//  - follows:  auto — all shows from the viewer's followed entities of a type, by recency
//  - combined: auto — the union of other show lists, filtered to a baked date window
//              and ordered by soonest upcoming performance (see resolveDynamicListItems)
export const LIST_SOURCE_MODES = ['manual', 'entity', 'follows', 'combined'] as const
export type ListSourceMode = typeof LIST_SOURCE_MODES[number]

// Entity kinds a dynamic list can source shows from (aligns with EntityFollow target types)
export const LIST_SOURCE_ENTITY_TYPES = ['venue', 'person', 'productionCompany'] as const
export type ListSourceEntityType = typeof LIST_SOURCE_ENTITY_TYPES[number]

// Date windows a combined list can filter to. Computed relative to "now" in
// America/New_York at query time — see dateWindows.ts.
export const LIST_DATE_WINDOWS = ['tonight', 'tomorrow', 'this_weekend', 'this_week', 'next_week', 'this_month'] as const
export type ListDateWindow = typeof LIST_DATE_WINDOWS[number]

export interface IList {
  name: string
  slug: string
  description: string
  listType: ListType
  isPublic: boolean
  isEditorial: boolean
  isActive: boolean
  displayOrder: number
  owner: Types.ObjectId
  collaborators: Types.ObjectId[]
  itemCount: number
  sourceMode: ListSourceMode
  sourceEntityType?: ListSourceEntityType
  sourceEntityId?: Types.ObjectId
  followTargetType?: ListSourceEntityType
  sourceListIds?: Types.ObjectId[]
  dateWindow?: ListDateWindow
  createdAt: Date
  updatedAt: Date
}

const listSchema = new Schema<IList>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  listType: {
    type: String,
    required: true,
    enum: LIST_TYPES
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  isEditorial: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: false
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  collaborators: [{
    type: Schema.Types.ObjectId,
    ref: 'user'
  }],
  itemCount: {
    type: Number,
    default: 0
  },
  sourceMode: {
    type: String,
    enum: LIST_SOURCE_MODES,
    default: 'manual'
  },
  sourceEntityType: {
    type: String,
    enum: LIST_SOURCE_ENTITY_TYPES,
    required: false
  },
  sourceEntityId: {
    type: Schema.Types.ObjectId,
    required: false
  },
  followTargetType: {
    type: String,
    enum: LIST_SOURCE_ENTITY_TYPES,
    required: false
  },
  // combined-mode: the other show lists this list unions over
  sourceListIds: [{
    type: Schema.Types.ObjectId,
    ref: 'list'
  }],
  // combined-mode: the date window to filter the union down to
  dateWindow: {
    type: String,
    enum: LIST_DATE_WINDOWS,
    required: false
  }
}, {
  timestamps: true
})

listSchema.index({ owner: 1, createdAt: -1 })
listSchema.index({ slug: 1, owner: 1 }, { unique: true })
listSchema.index({ isPublic: 1, createdAt: -1 })
listSchema.index({ isEditorial: 1, displayOrder: 1 })
listSchema.index({ collaborators: 1 })

export const ListModel = (mongoose.models.list as mongoose.Model<IList>) || mongoose.model<IList>('list', listSchema)
