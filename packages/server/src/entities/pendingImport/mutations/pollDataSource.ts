import { GraphQLString, GraphQLNonNull, GraphQLInt } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { UserModel } from '../../user/userModel'
import { DataSourceModel } from '../../dataSource/dataSourceModel'
import { PendingImportModel } from '../pendingImportModel'
import { parseFeed, CleanupRules } from '../../../services/feedParser/parseFeed'

export const pollDataSource = mutationWithClientMutationId({
  name: 'pollDataSource',
  description: 'Fetch a feed and create pending imports for new events',
  inputFields: {
    dataSourceId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'DataSource MongoDB ID'
    }
  },
  outputFields: {
    eventsFound: {
      type: GraphQLInt,
      resolve: r => r.eventsFound
    },
    eventsCreated: {
      type: GraphQLInt,
      resolve: r => r.eventsCreated
    },
    eventsSkipped: {
      type: GraphQLInt,
      resolve: r => r.eventsSkipped
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ dataSourceId }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    const ds = await DataSourceModel.findById(dataSourceId)
    if (!ds) return { error: 'Data source not found' }
    if (!ds.url) return { error: 'Data source has no feed URL' }
    if (ds.type !== 'rss' && ds.type !== 'ical') {
      return { error: `Cannot poll a ${ds.type} data source` }
    }

    // Rate limit: minimum 1 hour between polls per source
    const MIN_POLL_INTERVAL_MS = 60 * 60 * 1000
    if (ds.lastPolledAt) {
      const elapsed = Date.now() - new Date(ds.lastPolledAt).getTime()
      if (elapsed < MIN_POLL_INTERVAL_MS) {
        const minutesLeft = Math.ceil((MIN_POLL_INTERVAL_MS - elapsed) / 60000)
        return { error: `Rate limited: wait ${minutesLeft} more minute${minutesLeft === 1 ? '' : 's'} before polling again` }
      }
    }

    try {
      const rules: CleanupRules = (ds.config as any) || {}
      const events = await parseFeed(ds.type as 'rss' | 'ical', ds.url, rules)

      let created = 0
      let skipped = 0

      for (const event of events) {
        // Skip events without a title
        if (!event.title?.trim()) {
          skipped++
          continue
        }

        // Deduplicate: skip if we already have a pending import with the same
        // title + date from this source
        const existingQuery: any = {
          dataSource: ds._id,
          title: event.title.trim()
        }
        if (event.date) {
          existingQuery.date = event.date
        }
        const existing = await PendingImportModel.findOne(existingQuery)
        if (existing) {
          skipped++
          continue
        }

        await new PendingImportModel({
          dataSource: ds._id,
          status: 'pending',
          title: event.title.trim(),
          showDescription: event.description,
          date: event.date,
          time: event.time,
          ticketUrl: event.ticketUrl,
          // Apply defaults from cleanup rules
          venueName: rules.defaultVenue || undefined,
          stageName: rules.defaultStage || undefined,
          companyName: rules.defaultCompany || undefined,
          performanceTypes: rules.defaultTypes || undefined,
          rawData: event.rawData,
          importedAt: new Date()
        }).save()
        created++
      }

      // Update source polling metadata
      ds.lastPolledAt = new Date()
      await ds.save()

      return { eventsFound: events.length, eventsCreated: created, eventsSkipped: skipped }
    } catch (err: any) {
      // Update source with error info
      ds.lastPolledAt = new Date()
      await ds.save()
      return { error: `Feed fetch failed: ${err.message}` }
    }
  }
})
