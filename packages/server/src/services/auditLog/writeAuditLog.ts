import { Types } from 'mongoose'
import {
  AuditLogModel,
  AuditTargetKind,
  AuditAuthorKind,
  ApprovalSource,
  IAuditLog,
} from '../../entities/auditLog/auditLogModel'
import { incrementEditActivity } from '../antiAbuse/incrementEditActivity'

// Single entry point for recording an edit to an existing record. Every
// update mutation calls this after a successful write. For record creation
// (oldDoc === null) we record a `_created: true` snapshot per the Phase 3
// scoping doc's open-questions guidance.
//
// Diff shape for edits: { fieldName: { old, new }, ... } — one entry per
// field whose value actually changed.

export interface WriteAuditLogOptions {
  target: {
    kind: AuditTargetKind
    id: Types.ObjectId | string
  }
  author: {
    kind: AuditAuthorKind
    userId?: Types.ObjectId | string | null
    dataSourceId?: Types.ObjectId | string | null
    label?: string
  }
  oldDoc: Record<string, any> | null
  newDoc: Record<string, any>
  approvalSource: ApprovalSource
  approvalContext?: Record<string, any>
  isRevert?: boolean
  revertOf?: Types.ObjectId | string | null
}

// Fields we never include in a diff — they're either metadata Mongoose
// manages or noisy/expensive to compare.
const IGNORED_FIELDS = new Set([
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
])

function normalize(value: any): any {
  if (value === undefined) return null
  if (value === null) return null
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Types.ObjectId) return value.toString()
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value === 'object') {
    // Plain object — shallow normalize. We don't recurse arbitrarily deep;
    // the JSON.stringify-based equality check below handles structural eq.
    const out: Record<string, any> = {}
    for (const k of Object.keys(value)) out[k] = normalize(value[k])
    return out
  }
  return value
}

function equal(a: any, b: any): boolean {
  if (a === b) return true
  return JSON.stringify(a) === JSON.stringify(b)
}

function computeDiff(
  oldDoc: Record<string, any>,
  newDoc: Record<string, any>
): Record<string, { old: any; new: any }> {
  const diff: Record<string, { old: any; new: any }> = {}
  const keys = new Set([...Object.keys(oldDoc), ...Object.keys(newDoc)])
  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) continue
    const oldVal = normalize(oldDoc[key])
    const newVal = normalize(newDoc[key])
    if (!equal(oldVal, newVal)) {
      diff[key] = { old: oldVal, new: newVal }
    }
  }
  return diff
}

export async function writeAuditLog(opts: WriteAuditLogOptions): Promise<IAuditLog> {
  const diff = opts.oldDoc === null
    ? { _created: true, snapshot: normalize(opts.newDoc) }
    : computeDiff(opts.oldDoc, opts.newDoc)

  const row = await AuditLogModel.create({
    target: {
      kind: opts.target.kind,
      id: opts.target.id,
    },
    author: {
      kind: opts.author.kind,
      userId: opts.author.userId ?? null,
      dataSourceId: opts.author.dataSourceId ?? null,
      label: opts.author.label,
    },
    diff,
    approvalSource: opts.approvalSource,
    approvalContext: opts.approvalContext ?? {},
    isRevert: opts.isRevert ?? false,
    revertOf: opts.revertOf ?? null,
  })

  // Phase 7 — bump editCount / fire autoconfirmed_achieved when a User
  // author publishes. Scraper / SyncFeed / System authors don't count.
  if (opts.author.kind === 'User' && opts.author.userId) {
    await incrementEditActivity(opts.author.userId)
  }

  return row
}

export { computeDiff as _computeDiffForTest }
