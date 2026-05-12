export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { connectToDatabase } from '../../../../../../server/src/db/mongoose'
import { processSyncHealth } from '../../../../../../server/src/services/sync/processSyncHealth'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectToDatabase()

  const startedAt = Date.now()
  const result = await processSyncHealth()
  const durationMs = Date.now() - startedAt

  console.log(`[cron/sync-health-check] ${durationMs}ms`, result)

  return NextResponse.json({ ok: true, durationMs, ...result })
}
