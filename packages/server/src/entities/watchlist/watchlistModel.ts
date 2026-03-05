import mongoose, { Schema, Types } from 'mongoose'

export interface IWatchlistItem {
  user: Types.ObjectId
  show: Types.ObjectId
  note?: string
  createdAt: Date
  updatedAt: Date
}

const schema = new Schema<IWatchlistItem>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  show: {
    type: Schema.Types.ObjectId,
    ref: 'show',
    required: true
  },
  note: {
    type: String
  }
}, {
  timestamps: true
})

// Prevent duplicate watchlist entries
schema.index({ user: 1, show: 1 }, { unique: true })
// Efficient queries: "my watchlist" sorted by recency
schema.index({ user: 1, createdAt: -1 })
// Efficient queries: count how many users have this show on their watchlist
schema.index({ show: 1 })

export const WatchlistItemModel = (mongoose.models.watchlistItem as mongoose.Model<IWatchlistItem>) || mongoose.model<IWatchlistItem>('watchlistItem', schema)
