export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { connectToDatabase } from '../../../../../../server/src/db/mongoose'
import { processBlockVolumeCheck } from '../../../../../../server/src/services/antiAbuse/processBlockVolumeCheck'

// Phase 7 — daily cron. Finds claimants exceeding the block-volume threshold
// and fires `high_block_volume_alert` notifications to every admin user.

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
  const result = await processBlockVolumeCheck()
  const durationMs = Date.now() - startedAt

  console.log(`[cron/block-volume-check] ${durationMs}ms`, result)

  return NextResponse.json({ ok: true, durationMs, ...result })
}
