import { DataSourceModel } from '../../entities/dataSource/dataSourceModel'
import { runSync, SyncResult } from './runSync'

// Phase 6 — cron tick. Finds claimant-sync DataSources due for a poll, runs
// them with bounded concurrency. Each DataSource has its own cooldownHours
// (RSS 0.5h, iCal 1h by default — see createClaimantSync).

const DEFAULT_COOLDOWN_HOURS = 1
// Bounded concurrency so a sudden flood of due feeds doesn't fan out to N
// simultaneous outbound requests. Tuneable.
const CONCURRENCY = 4

interface RunnerResult {
  scanned: number
  ran: number
  succeeded: number
  failed: number
  details: SyncResult[]
}

function dueQuery(now: Date) {
  const oneHourAgoFallback = new Date(now.getTime() - DEFAULT_COOLDOWN_HOURS * 60 * 60 * 1000)
  // Mongo can't do "lastPolledAt + cooldownHours < now" without aggregation;
  // we approximate by selecting active claimant-syncs polled more than
  // DEFAULT_COOLDOWN_HOURS ago OR never polled, then filter per-doc in JS.
  return {
    purpose: 'claimant-sync' as const,
    isActive: true,
    $or: [
      { lastPolledAt: { $exists: false } },
      { lastPolledAt: null },
      { lastPolledAt: { $lt: oneHourAgoFallback } },
    ],
  }
}

function isDue(ds: any, now: Date): boolean {
  if (!ds.lastPolledAt) return true
  const cooldownMs = (ds.cooldownHours ?? DEFAULT_COOLDOWN_HOURS) * 60 * 60 * 1000
  return now.getTime() - new Date(ds.lastPolledAt).getTime() >= cooldownMs
}

async function runInBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size)
    const results = await Promise.all(batch.map(fn))
    out.push(...results)
  }
  return out
}

export async function processSyncRunner(opts: { now?: Date } = {}): Promise<RunnerResult> {
  const now = opts.now ?? new Date()
  const candidates = await DataSourceModel.find(dueQuery(now))
  const dueDocs = candidates.filter(d => isDue(d, now))

  const results = await runInBatches(dueDocs, CONCURRENCY, ds => runSync(ds, { now }))

  return {
    scanned: candidates.length,
    ran: dueDocs.length,
    succeeded: results.filter(r => r.errors.length === 0).length,
    failed: results.filter(r => r.errors.length > 0).length,
    details: results,
  }
}
