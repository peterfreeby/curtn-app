import { Types } from 'mongoose'
import { AuditLogModel, AuditTargetKind } from '../../entities/auditLog/auditLogModel'

// Phase 6 D4 — conflict detection for claimant sync.
//
// For an incoming feed value on `field` of `target`, decide whether to auto-
// apply or route to the Proposal queue:
//   - Most recent AuditLog row touching this field was authored by the same
//     DataSource ⇒ no conflict (recursive sync re-publishing its own value).
//   - Most recent row was authored by a user ⇒ conflict; queue.
//   - No prior row touches this field on this record ⇒ no conflict (first
//     write; the feed is establishing the value).
//
// Notes:
//   - `_created`/`snapshot` rows count as "touching every field" only insofar
//     as the field is present in the snapshot; we treat them like real touches
//     so a manual `_created` user authorship still wins.
//   - Reverts are normal rows — their author is whoever did the revert, so
//     conflict logic follows the same rules.

export interface DetectConflictArgs {
  target: { kind: AuditTargetKind; id: Types.ObjectId | string }
  field: string
  dataSourceId: Types.ObjectId | string
}

export interface DetectConflictResult {
  conflict: boolean
  reason: 'no-history' | 'same-source' | 'user-author' | 'other-source'
}

export async function detectConflict(args: DetectConflictArgs): Promise<DetectConflictResult> {
  const targetId = typeof args.target.id === 'string' ? new Types.ObjectId(args.target.id) : args.target.id
  const dataSourceId = typeof args.dataSourceId === 'string' ? new Types.ObjectId(args.dataSourceId) : args.dataSourceId

  // Scan recent rows touching the field; filter in-memory rather than building
  // a Mongo path query because diff is `Mixed`.
  const recent = await AuditLogModel.find({
    'target.kind': args.target.kind,
    'target.id': targetId,
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .select('author diff')
    .lean()

  for (const row of recent) {
    const diff: any = row.diff ?? {}
    const touched =
      Object.prototype.hasOwnProperty.call(diff, args.field) ||
      (diff._created === true && diff.snapshot && Object.prototype.hasOwnProperty.call(diff.snapshot, args.field))
    if (!touched) continue

    const author = row.author ?? {}
    if (author.kind === 'SyncFeed' && author.dataSourceId && author.dataSourceId.toString() === dataSourceId.toString()) {
      return { conflict: false, reason: 'same-source' }
    }
    if (author.kind === 'User') {
      return { conflict: true, reason: 'user-author' }
    }
    // Different SyncFeed source, or Scraper/System — treat as conflict so the
    // claimant has a say. v1 defaults to safe.
    return { conflict: true, reason: 'other-source' }
  }

  return { conflict: false, reason: 'no-history' }
}
