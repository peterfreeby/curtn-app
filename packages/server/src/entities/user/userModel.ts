import mongoose, { Schema } from 'mongoose'

export type IUser = {
  _id: mongoose.Types.ObjectId
  firebaseUid: string
  phoneNumber: string
  fullName?: string
  email?: string
  username?: string
  bio: string
  avatarUrl: string
  isAdmin: boolean
  personId?: mongoose.Types.ObjectId
  // Phase 7 — anti-abuse signal fields. `createdAt` was not previously on the
  // schema (no `timestamps: true`). `editCount` is a denormalized cache of
  // (AuditLog + Proposal) rows authored by this user; `firstEditAt` is the
  // earliest such row. Together they drive the autoconfirmed gate.
  createdAt: Date
  editCount: number
  firstEditAt: Date | null
  autoconfirmedAchievedAt: Date | null
}

const schema = new Schema<IUser>({
  firebaseUid: {
    type: String,
    required: true,
    unique: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  fullName: {
    type: String
  },
  email: {
    type: String,
    sparse: true
  },
  username: {
    type: String,
    sparse: true,
    unique: true
  },
  bio: {
    type: String,
    default: ''
  },
  avatarUrl: {
    type: String,
    default: ''
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  personId: {
    type: Schema.Types.ObjectId,
    ref: 'person',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  editCount: {
    type: Number,
    default: 0,
    index: true,
  },
  firstEditAt: {
    type: Date,
    default: null,
  },
  autoconfirmedAchievedAt: {
    type: Date,
    default: null,
  },
})

schema.index({ personId: 1 }, { unique: true, sparse: true })

schema.index({
  fullName: 'text',
  phoneNumber: 'text'
})

export const UserModel = (mongoose.models.user as mongoose.Model<IUser>) || mongoose.model<IUser>('user', schema)
