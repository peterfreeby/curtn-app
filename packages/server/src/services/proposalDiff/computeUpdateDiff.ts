import { Types } from 'mongoose'

// Produces a Proposal-style diff (`{ field: { old, new } }`) from an
// `updates` object (Mongoose `$set`-style) compared against the current
// document's values. Only fields whose value would actually change are
// included.

function normalize(value: any): any {
  if (value === undefined) return null
  if (value === null) return null
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Types.ObjectId) return value.toString()
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value === 'object') {
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

export function computeUpdateDiff(
  currentDoc: Record<string, any>,
  updates: Record<string, any>,
): Record<string, { old: any; new: any }> {
  const diff: Record<string, { old: any; new: any }> = {}
  for (const key of Object.keys(updates)) {
    const oldVal = normalize(currentDoc[key])
    const newVal = normalize(updates[key])
    if (!equal(oldVal, newVal)) {
      diff[key] = { old: oldVal, new: newVal }
    }
  }
  return diff
}
