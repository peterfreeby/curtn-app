import mongoose from 'mongoose'
import { getEnvironmentVariables } from '../config/env'

const { MONGODB_URL } = getEnvironmentVariables()

// Global connection cache for serverless environments
let cached = (global as any).__mongoose_connection as {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
} | undefined

if (!cached) {
  cached = (global as any).__mongoose_connection = { conn: null, promise: null }
}

export async function connectToDatabase() {
  if (cached!.conn) {
    return cached!.conn
  }

  if (!cached!.promise) {
    mongoose.connection
      .on('error', err => console.error(err))
      .once('open', () => {
        if (process.env.TESTING !== 'true') console.log('Connected to database')
      })

    cached!.promise = mongoose.connect(MONGODB_URL!).then((m) => m)
  }

  cached!.conn = await cached!.promise
  return cached!.conn
}

export async function disconnectFromDatabase() {
  await mongoose.connection.close()
  cached!.conn = null
  cached!.promise = null
}
