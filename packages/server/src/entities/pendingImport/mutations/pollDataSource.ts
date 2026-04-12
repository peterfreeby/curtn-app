import { GraphQLString, GraphQLNonNull, GraphQLInt } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { UserModel } from '../../user/userModel'
import { DataSourceModel } from '../../dataSource/dataSourceModel'
import { PendingImportModel } from '../pendingImportModel'
import { parseFeed, parseRssFeed, CleanupRules } from '../../../services/feedParser/parseFeed'
import { ParsedEvent } from '../../../services/feedParser/shared'
import { fetchPage, applyTemplate, ParsingTemplate } from '../../../services/pageFetcher'

const MAX_PAGE_FETCHES_PER_POLL = 10
const FETCH_DELAY_MS = 1000
const MAX_FETCHED_URLS = 1000

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface Presets {
  venueName?: string
  companyName?: string
  stageName?: string
  performanceTypes?: string[]
}

async function createPendingImports(
  events: ParsedEvent[],
  dsId: any,
  rules: CleanupRules,
  presets?: Presets
): Promise<{ created: number; skipped: number }> {
  let created = 0
  let skipped = 0

  for (const event of events) {
    if (!event.title?.trim()) {
      skipped++
      continue
    }

    const existingQuery: any = {
      dataSource: dsId,
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
      dataSource: dsId,
      status: 'pending',
      title: event.title.trim(),
      showDescription: event.showDescription || event.description,
      runTitle: event.runTitle,
      runDescription: event.runDescription,
      duration: event.duration,
      date: event.date,
      time: event.time,
      ticketUrl: event.ticketUrl,
      imageUrl: event.imageUrl,
      startDate: event.startDate,
      endDate: event.endDate,
      credits: event.credits,
      // Presets take priority, then extracted values, then cleanup rule defaults
      venueName: presets?.venueName || event.rawData?.venue || rules.defaultVenue || undefined,
      stageName: presets?.stageName || rules.defaultStage || undefined,
      companyName: presets?.companyName || rules.defaultCompany || undefined,
      performanceTypes: presets?.performanceTypes || rules.defaultTypes || undefined,
      rawData: event.rawData,
      importedAt: new Date()
    }).save()
    created++
  }

  return { created, skipped }
}

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
    if (ds.type !== 'rss' && ds.type !== 'ical' && ds.type !== 'web') {
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
      const template: ParsingTemplate | undefined = (ds.config as any)?.parsingTemplate
      const presets: Presets | undefined = (ds.config as any)?.presets

      // --- Web source: poll detection RSS, then fetch + parse each page ---
      if (ds.type === 'web') {
        if (!template) {
          return { error: 'Web data source has no parsing template configured' }
        }

        // Poll the changedetection.io RSS feed
        const feedItems = await parseRssFeed(ds.url, {})
        const fetchedSet = new Set(ds.fetchedUrls || [])

        // Filter to new URLs only
        const newItems = feedItems.filter(item => {
          const url = item.ticketUrl || item.rawData?.link
          return url && !fetchedSet.has(url)
        })

        let totalFound = 0
        let totalCreated = 0
        let totalSkipped = 0
        let pagesFetched = 0

        for (const item of newItems) {
          if (pagesFetched >= MAX_PAGE_FETCHES_PER_POLL) break

          const pageUrl = item.ticketUrl || item.rawData?.link
          if (!pageUrl) continue

          try {
            if (pagesFetched > 0) await sleep(FETCH_DELAY_MS)

            const html = await fetchPage(pageUrl)
            const events = applyTemplate(html, template, pageUrl)

            totalFound += events.length
            const { created, skipped } = await createPendingImports(events, ds._id, rules, presets)
            totalCreated += created
            totalSkipped += skipped

            // Track this URL as processed
            if (!ds.fetchedUrls) ds.fetchedUrls = []
            ds.fetchedUrls.push(pageUrl)
            pagesFetched++
          } catch (err: any) {
            console.error(`Failed to fetch/parse ${pageUrl}:`, err.message)
            // Log failure but continue with other URLs
            totalSkipped++
          }
        }

        // Trim fetchedUrls to most recent entries
        if (ds.fetchedUrls && ds.fetchedUrls.length > MAX_FETCHED_URLS) {
          ds.fetchedUrls = ds.fetchedUrls.slice(-MAX_FETCHED_URLS)
        }

        ds.lastPolledAt = new Date()
        await ds.save()

        return { eventsFound: totalFound, eventsCreated: totalCreated, eventsSkipped: totalSkipped }
      }

      // --- RSS/iCal source: standard feed parsing ---
      const events = await parseFeed(ds.type as 'rss' | 'ical', ds.url, rules)

      // Optional: enrich RSS events with parsing template
      if (ds.type === 'rss' && template) {
        let enriched = 0
        for (const event of events) {
          if (enriched >= MAX_PAGE_FETCHES_PER_POLL) break
          if (!event.ticketUrl) continue

          try {
            if (enriched > 0) await sleep(FETCH_DELAY_MS)

            const html = await fetchPage(event.ticketUrl)
            const parsed = applyTemplate(html, template, event.ticketUrl)
            if (parsed.length > 0) {
              const enrichedEvent = parsed[0]
              // Only fill in missing fields — don't overwrite RSS data
              if (!event.description && enrichedEvent.description) {
                event.description = enrichedEvent.description
              }
              if (!event.date && enrichedEvent.date) {
                event.date = enrichedEvent.date
              }
              if (!event.time && enrichedEvent.time) {
                event.time = enrichedEvent.time
              }
              // Pull venue from rawData if extracted
              if (enrichedEvent.rawData?.venue) {
                event.rawData.enrichedVenue = enrichedEvent.rawData.venue
              }
              if (enrichedEvent.rawData?.imageUrl) {
                event.rawData.enrichedImageUrl = enrichedEvent.rawData.imageUrl
              }
            }
            enriched++
          } catch {
            // Enrichment is best-effort — continue with original RSS data
          }
        }
      }

      const { created, skipped } = await createPendingImports(events, ds._id, rules, presets)

      ds.lastPolledAt = new Date()
      await ds.save()

      return { eventsFound: events.length, eventsCreated: created, eventsSkipped: skipped }
    } catch (err: any) {
      ds.lastPolledAt = new Date()
      await ds.save()
      return { error: `Feed fetch failed: ${err.message}` }
    }
  }
})
