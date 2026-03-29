export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import {
  S3Client,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import { connectToDatabase } from '../../../../../../server/src/db/mongoose'
import { getUser } from '../../../../../../server/src/auth/getUser'
import mongoose from 'mongoose'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
})

// Simple MongoDB collection for caching stats
function getStatsCollection() {
  return mongoose.connection.db!.collection('storageStats')
}

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const FREE_TIER_BYTES = 10 * 1024 * 1024 * 1024 // 10 GB
const COST_PER_GB = 0.015 // R2 storage cost beyond free tier

interface EntityStats {
  count: number
  bytes: number
}

interface StorageStats {
  totalCount: number
  totalBytes: number
  byEntityType: Record<string, EntityStats>
  monthlyUploads: { count: number; bytes: number }
  estimatedMonthlyCost: number
  freeTierRemainingBytes: number
  updatedAt: Date
}

async function queryR2Stats(): Promise<StorageStats> {
  const byEntityType: Record<string, EntityStats> = {}
  let totalCount = 0
  let totalBytes = 0
  let monthlyCount = 0
  let monthlyBytes = 0

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  let continuationToken: string | undefined

  do {
    const response: ListObjectsV2CommandOutput = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      })
    )

    for (const obj of response.Contents ?? []) {
      const size = obj.Size ?? 0
      totalCount++
      totalBytes += size

      // Extract entity type from key prefix (e.g., "show/123/file.jpg" → "show")
      const entityType = obj.Key?.split('/')[0] ?? 'unknown'
      if (!byEntityType[entityType]) {
        byEntityType[entityType] = { count: 0, bytes: 0 }
      }
      byEntityType[entityType].count++
      byEntityType[entityType].bytes += size

      // Track this month's uploads
      if (obj.LastModified && obj.LastModified >= monthStart) {
        monthlyCount++
        monthlyBytes += size
      }
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined
  } while (continuationToken)

  const billableBytes = Math.max(0, totalBytes - FREE_TIER_BYTES)
  const billableGB = billableBytes / (1024 * 1024 * 1024)
  const estimatedMonthlyCost = Math.round(billableGB * COST_PER_GB * 100) / 100

  return {
    totalCount,
    totalBytes,
    byEntityType,
    monthlyUploads: { count: monthlyCount, bytes: monthlyBytes },
    estimatedMonthlyCost,
    freeTierRemainingBytes: Math.max(0, FREE_TIER_BYTES - totalBytes),
    updatedAt: new Date(),
  }
}

export async function GET(request: Request) {
  try {
    await connectToDatabase()

    // Auth check — admin only
    const authorization =
      request.headers.get('authorization') || undefined
    const user = await getUser({ authorization })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { UserModel } = await import(
      '../../../../../../server/src/entities/user/userModel'
    )
    const adminUser = await UserModel.findById(user.id)
    if (!adminUser?.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const collection = getStatsCollection()

    // Check for ?refresh=true to force recalculation
    const url = new URL(request.url)
    const forceRefresh = url.searchParams.get('refresh') === 'true'

    if (!forceRefresh) {
      // Return cached stats if fresh enough
      const cached = await collection.findOne({ _id: 'current' })
      if (
        cached?.updatedAt &&
        Date.now() - new Date(cached.updatedAt).getTime() < CACHE_TTL_MS
      ) {
        return NextResponse.json(cached.stats)
      }
    }

    // Query R2 and cache
    const stats = await queryR2Stats()

    await collection.updateOne(
      { _id: 'current' },
      { $set: { stats, updatedAt: stats.updatedAt } },
      { upsert: true }
    )

    return NextResponse.json(stats)
  } catch (err) {
    console.error('Storage stats error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch storage stats' },
      { status: 500 }
    )
  }
}
