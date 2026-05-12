export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { connectToDatabase } from '../../../../../../server/src/db/mongoose'
import { processSyncRunner } from '../../../../../../server/src/services/sync/processSyncRunner'

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
  const result = await processSyncRunner()
  const durationMs = Date.now() - startedAt

  console.log(`[cron/sync-runner] ${durationMs}ms`, {
    scanned: result.scanned,
    ran: result.ran,
    succeeded: result.succeeded,
    failed: result.failed,
  })

  return NextResponse.json({ ok: true, durationMs, ...result })
}
