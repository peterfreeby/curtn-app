/**
 * Reset User Script
 *
 * Deletes a user's MongoDB record (and related data) so the next login
 * triggers the new-user onboarding flow — without needing a fresh phone number.
 * The Firebase Auth account stays intact, so the same phone + OTP still works.
 *
 * Usage:
 *   yarn reset:user --phone +15551234567
 *   yarn reset:user --username peterfreeby
 */

import mongoose from 'mongoose'
import { connectToDatabase, disconnectFromDatabase } from '../db/mongoose'
import { UserModel } from '../entities/user/userModel'
import { ReviewModel } from '../entities/review/reviewModel'
import { FollowModel } from '../entities/follow/followModel'
import { WatchlistItemModel } from '../entities/watchlist/watchlistModel'
import { CommentModel } from '../entities/comment/commentModel'

async function main() {
  const args = process.argv.slice(2)
  const phoneIdx = args.indexOf('--phone')
  const usernameIdx = args.indexOf('--username')

  if (phoneIdx === -1 && usernameIdx === -1) {
    console.error('Usage: yarn reset:user --phone +15551234567')
    console.error('       yarn reset:user --username yourname')
    process.exit(1)
  }

  const query: Record<string, string> = {}
  if (phoneIdx !== -1 && args[phoneIdx + 1]) {
    query.phoneNumber = args[phoneIdx + 1]
  } else if (usernameIdx !== -1 && args[usernameIdx + 1]) {
    query.username = args[usernameIdx + 1]
  }

  await connectToDatabase()

  const user = await UserModel.findOne(query)
  if (!user) {
    console.log('No user found matching', query)
    await disconnectFromDatabase()
    process.exit(0)
  }

  console.log(`Found user: ${user.fullName || '(no name)'} (@${user.username || 'no username'})`)
  console.log(`  Phone: ${user.phoneNumber}`)
  console.log(`  Firebase UID: ${user.firebaseUid}`)
  console.log(`  ID: ${user._id}`)
  console.log()

  // Delete related data
  const reviews = await ReviewModel.deleteMany({ userId: user._id })
  const follows = await FollowModel.deleteMany({
    $or: [{ followerId: user._id }, { followingId: user._id }],
  })
  const watchlist = await WatchlistItemModel.deleteMany({ userId: user._id })
  const comments = await CommentModel.deleteMany({ userId: user._id })

  console.log(`Deleted related data:`)
  console.log(`  Reviews: ${reviews.deletedCount}`)
  console.log(`  Follows: ${follows.deletedCount}`)
  console.log(`  Watchlist items: ${watchlist.deletedCount}`)
  console.log(`  Comments: ${comments.deletedCount}`)

  // Delete the user
  await UserModel.deleteOne({ _id: user._id })
  console.log(`\nUser deleted. Next login with this phone number will trigger onboarding.`)

  await disconnectFromDatabase()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
