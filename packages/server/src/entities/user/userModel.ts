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
  }
})

schema.index({ personId: 1 }, { unique: true, sparse: true })

schema.index({
  fullName: 'text',
  phoneNumber: 'text'
})

export const UserModel = (mongoose.models.user as mongoose.Model<IUser>) || mongoose.model<IUser>('user', schema)
