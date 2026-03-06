import '../config/env'
import mongoose from 'mongoose'
import { UserModel } from '../entities/user/userModel'

async function setAdmin() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')

  await mongoose.connect(mongoUrl)

  const username = process.argv[2] || 'peter'
  const user = await UserModel.findOne({ username })
  if (!user) {
    console.log(`User "${username}" not found`)
    process.exit(1)
  }

  user.isAdmin = true
  await user.save()
  console.log(`${user.username} is now an admin`)

  await mongoose.disconnect()
}

setAdmin().catch(console.error)
