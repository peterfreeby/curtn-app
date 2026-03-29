import { compareSync } from 'bcrypt'
import mongoose, { Schema } from 'mongoose'

export type IUser = {
  _id: mongoose.Types.ObjectId
  fullName: string
  email: string
  username: string
  password: string
  bio: string
  avatarUrl: string
  isAdmin: boolean,
  personId?: mongoose.Types.ObjectId,
  validatePassword: (plainPassword: string) => boolean,
}

const schema = new Schema<IUser>({
  fullName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
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
  email: 'text'
})

schema.methods.validatePassword = function (plainPassword: string): boolean {
  return compareSync(plainPassword, this.password)
}

export const UserModel = (mongoose.models.user as mongoose.Model<IUser>) || mongoose.model<IUser>('user', schema)
