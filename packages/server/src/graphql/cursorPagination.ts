/**
 * Database-level cursor pagination utilities.
 *
 * Replaces the connectionFromArray pattern (fetch-all-then-slice)
 * with proper cursor-based pagination that pushes limits to MongoDB.
 *
 * Cursor format: base64(JSON({ sortValue, _id }))
 * The cursor encodes the sort field value and _id of the last item,
 * allowing the next page to seek past it with an indexed $or query.
 */

// === Lean document helper ===
// .lean() strips Mongoose virtuals including `id`. Restore it for GraphQL.
export function restoreLeanIds(docs: any[]): any[] {
  for (const doc of docs) {
    if (doc && doc._id && !doc.id) doc.id = doc._id.toString()
  }
  return docs
}

// Wrapper around graphql-relay's connectionFromArray that restores `id` on lean docs first.
import { connectionFromArray as _connectionFromArray } from 'graphql-relay'
export function connectionFromArrayLean(data: any[], args: any) {
  restoreLeanIds(data)
  return _connectionFromArray(data, args)
}

// === Cursor encoding/decoding ===

export function encodeCursor(sortField: string, doc: any): string {
  const payload: any = { _id: doc._id.toString() }
  const val = doc[sortField]
  // Dates serialize as ISO strings for safe JSON round-trip
  payload.v = val instanceof Date ? val.toISOString() : val
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

export function decodeCursor(cursor: string): { sortValue: any; _id: string } {
  const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'))
  return { sortValue: parsed.v, _id: parsed._id }
}

// === Apply cursor to a Mongoose .find() query ===

interface CursorOptions {
  after?: string | null
  first?: number | null
  sortField: string
  sortDirection: 1 | -1
  maxLimit?: number
}

export function applyCursorToQuery(
  filter: Record<string, any>,
  opts: CursorOptions
): { filter: Record<string, any>; sort: Record<string, 1 | -1>; limit: number } {
  const limit = Math.min(opts.first ?? 20, opts.maxLimit ?? 100)
  const sort: Record<string, 1 | -1> = { [opts.sortField]: opts.sortDirection, _id: opts.sortDirection }
  const mergedFilter = { ...filter }

  if (opts.after) {
    const { sortValue, _id } = decodeCursor(opts.after)
    const compareOp = opts.sortDirection === -1 ? '$lt' : '$gt'

    // Reconstruct Date objects for date fields
    const parsedSortValue = typeof sortValue === 'string' && !isNaN(Date.parse(sortValue)) && opts.sortField !== 'name' && opts.sortField !== 'slug'
      ? new Date(sortValue)
      : sortValue

    // Compound cursor: (sortField < cursorValue) OR (sortField == cursorValue AND _id < cursorId)
    const cursorCondition = {
      $or: [
        { [opts.sortField]: { [compareOp]: parsedSortValue } },
        { [opts.sortField]: parsedSortValue, _id: { [compareOp]: _id } }
      ]
    }

    // Merge with existing filter using $and
    if (mergedFilter.$and) {
      mergedFilter.$and.push(cursorCondition)
    } else if (Object.keys(mergedFilter).length > 0) {
      const existingFilter = { ...mergedFilter }
      // Clear individual keys and use $and
      for (const key of Object.keys(existingFilter)) {
        delete mergedFilter[key]
      }
      mergedFilter.$and = [existingFilter, cursorCondition]
    } else {
      Object.assign(mergedFilter, cursorCondition)
    }
  }

  // Fetch one extra to determine hasNextPage
  return { filter: mergedFilter, sort, limit: limit + 1 }
}

// === Apply cursor to an aggregate pipeline ===

export function applyCursorToAggregate(
  pipeline: any[],
  opts: CursorOptions
): any[] {
  const limit = Math.min(opts.first ?? 20, opts.maxLimit ?? 100)
  const result = [...pipeline]

  if (opts.after) {
    const { sortValue, _id } = decodeCursor(opts.after)
    const compareOp = opts.sortDirection === -1 ? '$lt' : '$gt'

    const parsedSortValue = typeof sortValue === 'string' && !isNaN(Date.parse(sortValue))
      ? new Date(sortValue)
      : sortValue

    result.push({
      $match: {
        $or: [
          { [opts.sortField]: { [compareOp]: parsedSortValue } },
          { [opts.sortField]: parsedSortValue, _id: { [compareOp]: _id } }
        ]
      }
    })
  }

  result.push(
    { $sort: { [opts.sortField]: opts.sortDirection, _id: opts.sortDirection } },
    { $limit: limit + 1 }
  )

  return result
}

// === Build a Relay connection object from fetched docs ===

export function buildConnection(docs: any[], opts: { first?: number | null; sortField: string; maxLimit?: number }) {
  const limit = Math.min(opts.first ?? 20, opts.maxLimit ?? 100)
  const hasNextPage = docs.length > limit
  const nodes = hasNextPage ? docs.slice(0, limit) : docs

  const edges = nodes.map(doc => {
    // Restore `id` virtual stripped by .lean()
    if (doc._id && !doc.id) doc.id = doc._id.toString()
    return { node: doc, cursor: encodeCursor(opts.sortField, doc) }
  })

  return {
    edges,
    pageInfo: {
      hasNextPage,
      hasPreviousPage: false, // We don't support backward pagination yet
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges[edges.length - 1]?.cursor ?? null
    }
  }
}
