/**
 * Execute the actual `myClaimRequests` GraphQL query against the schema.
 * Surfaces the GraphQL errors that null individual items, which `.lean()`-
 * level field checking missed.
 *
 * Usage:
 *   USER_ID=<your-objectid> npx tsnd --clear --transpile-only \
 *     src/scripts/runMyClaimRequestsQuery.ts
 *
 * If USER_ID isn't set, picks the user with the most ClaimRequest rows
 * (likely the one who's been testing).
 */

import { graphql } from 'graphql'
import { connectToDatabase, disconnectFromDatabase } from '../db/mongoose'
import { schema } from '../schemas/schema'
import { ClaimRequestModel } from '../entities/claimRequest/claimRequestModel'

async function main() {
  await connectToDatabase()
  console.log('Connected to database\n')

  let userId = process.env.USER_ID
  if (!userId) {
    const groups = await ClaimRequestModel.aggregate([
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ])
    if (groups.length === 0) {
      console.log('No ClaimRequests in DB.')
      await disconnectFromDatabase()
      return
    }
    userId = groups[0]._id.toString()
    console.log(`Using top-claim user: ${userId} (${groups[0].count} rows)\n`)
  }

  const result = await graphql({
    schema,
    source: `
      query MyClaimRequests {
        myClaimRequests {
          id
          status
          message
          requestedAt
          reviewedAt
          target { kind targetId name slug }
          person { id name slug }
        }
      }
    `,
    contextValue: { user: { id: userId } },
  })

  console.log('=== data.myClaimRequests ===')
  const items: any[] = (result.data as any)?.myClaimRequests ?? []
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    console.log(`[${i}]`, it === null ? 'NULL' : JSON.stringify(it).slice(0, 200))
  }

  console.log('\n=== errors ===')
  if (!result.errors || result.errors.length === 0) {
    console.log('(none)')
  } else {
    for (const e of result.errors) {
      console.log(`- path: ${JSON.stringify(e.path)}`)
      console.log(`  message: ${e.message}`)
      if ((e as any).originalError) {
        console.log(`  original: ${(e as any).originalError.stack ?? (e as any).originalError.message}`)
      }
    }
  }

  await disconnectFromDatabase()
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('runMyClaimRequestsQuery failed:', err)
  process.exit(1)
})
