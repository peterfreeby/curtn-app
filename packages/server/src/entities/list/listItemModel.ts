import mongoose, { Schema, Types } from 'mongoose'

export interface IListItem {
  list: Types.ObjectId
  itemId: Types.ObjectId
  position: number
  addedBy: Types.ObjectId
  note?: string
  createdAt: Date
  updatedAt: Date
}

const listItemSchema = new Schema<IListItem>({
  list: {
    type: Schema.Types.ObjectId,
    ref: 'list',
    required: true
  },
  itemId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  position: {
    type: Number,
    required: true,
    default: 0
  },
  addedBy: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  note: {
    type: String
  }
}, {
  timestamps: true
})

listItemSchema.index({ list: 1, position: 1 })
listItemSchema.index({ list: 1, itemId: 1 }, { unique: true })

export const ListItemModel = (mongoose.models.listItem as mongoose.Model<IListItem>) || mongoose.model<IListItem>('listItem', listItemSchema)
