import { GraphQLString, GraphQLNonNull, GraphQLInt, GraphQLList, GraphQLObjectType } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { parseFeed } from '../../../services/feedParser/parseFeed'

// Phase 6 — quick "does this feed look right?" preview for the connect UI.
// Fetches and parses the URL with no DB side effects; returns the first few
// items so the claimant can confirm before saving the DataSource.

const previewItemType = new GraphQLObjectType({
  name: 'SyncSourcePreviewItem',
  fields: () => ({
    title: { type: GraphQLString },
    description: { type: GraphQLString },
    date: { type: GraphQLString },
    time: { type: GraphQLString },
    ticketUrl: { type: GraphQLString },
  }),
})

export const testSyncSource = mutationWithClientMutationId({
  name: 'testSyncSource',
  description: 'Fetch and preview a sync feed without saving',
  inputFields: {
    feedType: { type: new GraphQLNonNull(GraphQLString) },
    url: { type: new GraphQLNonNull(GraphQLString) },
  },
  outputFields: {
    itemCount: {
      type: GraphQLInt,
      resolve: r => r.itemCount ?? 0,
    },
    preview: {
      type: new GraphQLList(previewItemType),
      resolve: r => r.preview ?? [],
    },
    ...errorField,
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    if (input.feedType !== 'rss' && input.feedType !== 'ical') {
      return { error: 'feedType must be rss or ical' }
    }
    if (!input.url?.trim()) return { error: 'url is required' }

    try {
      const items = await parseFeed(input.feedType as 'rss' | 'ical', input.url.trim(), {})
      const preview = items.slice(0, 5).map(it => ({
        title: it.title,
        description: it.description ?? null,
        date: it.date?.toISOString() ?? null,
        time: it.time ?? null,
        ticketUrl: it.ticketUrl ?? null,
      }))
      return { itemCount: items.length, preview }
    } catch (err: any) {
      return { error: `Fetch failed: ${err?.message ?? String(err)}` }
    }
  },
})
