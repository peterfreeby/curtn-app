import { GraphQLFieldConfig, GraphQLID, GraphQLList, GraphQLNonNull, GraphQLString } from 'graphql'
import { ShowConnection, showType } from '../showTypes'
import { ShowModel } from '../showModel'
import { connectionArgs, connectionFromArray, fromGlobalId } from 'graphql-relay'
import { applyCursorToQuery, buildConnection, connectionFromArrayLean } from '../../../graphql/cursorPagination'

// === Tolerant search helpers ===

// Cap on how many regex candidates we pull before ranking in JS. Keeps the
// (unindexed) substring scan bounded so a broad query can't fan out unboundedly.
const REGEX_CANDIDATE_LIMIT = 50

// Normalize a title for fuzzy comparison:
//  - lowercase
//  - strip all non-alphanumeric chars (spaces, punctuation, mashed compounds)
//  - collapse runs of the same char to a single char
// So "RAAAATSCRAPS", "raaatscraps" and "raatscraps" all converge to "ratscraps".
function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(.)\1+/g, '$1')
}

// Escape user input before embedding it in a RegExp so query chars like
// "(", "*", "." or "+" are treated literally instead of as regex operators.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Rank a candidate title against the query. Higher score = better match.
// Priority: exact normalized equality > normalized startsWith > normalized
// substring (either direction) > raw text score (fallback, kept small so the
// normalized tiers always win).
function matchScore(query: string, title: string, textScore: number): number {
  const nq = normalizeTitle(query)
  const nt = normalizeTitle(title)

  if (!nq) return textScore // empty/symbol-only query: defer to text score

  if (nt === nq) return 1000
  if (nt.startsWith(nq)) return 800
  // Substring either direction: query inside title, or title inside query
  // (handles the user typing a slightly longer/garbled version of the title).
  if (nt.includes(nq) || nq.includes(nt)) return 600
  // Fall back to Mongo's raw text score, clamped below the normalized tiers.
  return Math.min(textScore, 599)
}

// Merge two lean result arrays, deduping by _id (first occurrence wins).
function dedupeById(...groups: any[][]): any[] {
  const seen = new Set<string>()
  const merged: any[] = []
  for (const group of groups) {
    for (const doc of group) {
      const key = String(doc._id)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(doc)
    }
  }
  return merged
}

// Run the tolerant title search: union the existing $text results with a
// bounded case-insensitive substring regex match, then rank in JS and slice
// to `first`. Returns lean docs (with `id` virtual restored by the caller via
// connectionFromArrayLean). Venue search is untouched.
async function tolerantTitleSearch(query: string, first: number, extraFilter: Record<string, any> = {}): Promise<any[]> {
  // (a) Existing word/token text search — strong for multi-word queries.
  const textResults = await ShowModel.find(
    { ...extraFilter, $text: { $search: query } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(REGEX_CANDIDATE_LIMIT)
    .lean()

  // (b) Bounded case-insensitive substring match on title (escaped input).
  const regexResults = await ShowModel.find({
    ...extraFilter,
    title: { $regex: escapeRegex(query), $options: 'i' }
  })
    .limit(REGEX_CANDIDATE_LIMIT)
    .lean()

  // Union + dedupe by _id.
  const candidates = dedupeById(textResults, regexResults)

  // Rank by best match against the query, then take `first`.
  return candidates
    .map((doc: any) => ({
      doc,
      score: matchScore(query, doc.title ?? '', (doc as any).score ?? 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, first)
    .map(entry => entry.doc)
}

export const singleShow: GraphQLFieldConfig<any, any, { id: string }> = {
  type: showType,
  args: {
    id: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Show ID'
    }
  },
  resolve: async (_, args) => {
    try {
      const { id } = fromGlobalId(args.id)
      return await ShowModel.findById(id)
    } catch {
      return null
    }
  }
}

export const showList: GraphQLFieldConfig<any, any, any> = {
  type: ShowConnection,
  args: {
    ...connectionArgs,
    performanceTypes: {
      type: new GraphQLList(GraphQLString),
      description: 'Filter by performance types'
    },
    search: {
      type: GraphQLString,
      description: 'Search by title or description'
    }
  },
  resolve: async (_, args) => {
    const { performanceTypes, search, ...connArgs } = args
    const filter: any = {}

    if (performanceTypes && performanceTypes.length > 0) {
      filter.performanceTypes = { $in: performanceTypes }
    }

    try {
      // Search scores aren't stable across requests, so use connectionFromArray for search.
      // Reuse the same tolerant title search as searchShows (text + substring,
      // ranked in JS), carrying any performanceTypes filter through as extraFilter.
      if (search) {
        const limit = Math.min((connArgs as any).first ?? 100, 100)
        const shows = await tolerantTitleSearch(search, limit, filter)
        return connectionFromArrayLean(shows, connArgs)
      }

      // Non-search: proper cursor pagination
      const { filter: cursorFilter, sort, limit } = applyCursorToQuery(filter, {
        after: (connArgs as any).after,
        first: (connArgs as any).first,
        sortField: 'createdAt',
        sortDirection: -1
      })
      const shows = await ShowModel.find(cursorFilter).sort(sort).limit(limit).lean()
      return buildConnection(shows, { first: (connArgs as any).first, sortField: 'createdAt' })
    } catch (error) {
      console.error('Error fetching shows:', error)
      return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } }
    }
  }
}

export const searchShows: GraphQLFieldConfig<any, any, { query: string }> = {
  type: ShowConnection,
  args: {
    ...connectionArgs,
    query: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Search query'
    }
  },
  resolve: async (_, args) => {
    const { query, ...connArgs } = args

    try {
      // `first` bounds how many ranked results we return (same arg the old
      // resolver respected via connectionFromArray's slicing). Cap at 50.
      const first = Math.min((connArgs as any).first ?? 50, 50)

      // Tolerant union (text + substring regex) ranked in JS — see helper.
      const shows = await tolerantTitleSearch(query, first)

      // Same return shape as before: a relay connection of show edges.
      // connectionFromArrayLean === connectionFromArray + restores the `id`
      // virtual that .lean() strips, so edge nodes resolve identically.
      return connectionFromArrayLean(shows, connArgs)
    } catch (error) {
      console.error('Error searching shows:', error)
      return connectionFromArray([], connArgs)
    }
  }
}

export const showQueries = {
  singleShow,
  showList,
  searchShows
}
