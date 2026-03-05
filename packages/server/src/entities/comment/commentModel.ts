import mongoose, { Types, Schema } from 'mongoose'

export interface IComment {
  user: Types.ObjectId
  content: string
}

const schema = new Schema<IComment>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  content: {
    type: String,
    required: true
  }
})

export const CommentModel = (mongoose.models.comment as mongoose.Model<IComment>) || mongoose.model<IComment>('comment', schema)
