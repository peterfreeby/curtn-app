import { GraphQLString, GraphQLNonNull, GraphQLInt } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { UserModel } from '../../user/userModel'
import { DataSourceModel } from '../../dataSource/dataSourceModel'
import { PendingImportModel } from '../../pendingImport/pendingImportModel'
import { fetchPage, applyTemplate, ParsingTemplate } from '../../../services/pageFetcher'
import { CleanupRules } from '../../../services/feedParser/shared'

interface Presets {
  venueName?: string
  companyName?: string
  stageName?: string
  performanceTypes?: string[]
}

export const scrapeUrl = mutationWithClientMutationId({
  name: 'scrapeUrl',
  description: 'Scrape a single URL using a data source template and create pending imports',
  inputFields: {
    url: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'URL to scrape'
    },
    dataSourceId: {
      type: GraphQLString,
      description: 'DataSource MongoDB ID (uses its template and presets). Optional if template is provided directly.'
    },
    template: {
      type: GraphQLString,
      description: 'Parsing template as JSON string (used if no dataSourceId, or to override)'
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
    ...errorField
  },
  mutateAndGetPayload: async ({ url, dataSourceId, template: templateJson }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    let template: ParsingTemplate | undefined
    let presets: Presets | undefined
    let rules: CleanupRules = {}
    let dsId: any = undefined

    // Load from data source if provided
    if (dataSourceId) {
      const ds = await DataSourceModel.findById(dataSourceId)
      if (!ds) return { error: 'Data source not found' }
      dsId = ds._id
      template = (ds.config as any)?.parsingTemplate
      presets = (ds.config as any)?.presets
      rules = (ds.config as any) || {}
    }

    // Override with direct template if provided
    if (templateJson) {
      try {
        template = JSON.parse(templateJson)
      } catch {
        return { error: 'Invalid template JSON' }
      }
    }

    if (!template) {
      return { error: 'No parsing template available. Provide a dataSourceId with a configured template, or a template directly.' }
    }

    try {
      const html = await fetchPage(url)
      const events = applyTemplate(html, template, url)

      let created = 0
      for (const event of events) {
        if (!event.title?.trim()) continue

        // Dedup if we have a data source
        if (dsId) {
          const existingQuery: any = { dataSource: dsId, title: event.title.trim() }
          if (event.date) existingQuery.date = event.date
          const existing = await PendingImportModel.findOne(existingQuery)
          if (existing) continue
        }

        await new PendingImportModel({
          ...(dsId && { dataSource: dsId }),
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
          cast: event.cast,
          crew: event.crew,
          venueName: presets?.venueName || event.rawData?.venue || rules.defaultVenue || undefined,
          stageName: presets?.stageName || rules.defaultStage || undefined,
          companyName: presets?.companyName || rules.defaultCompany || undefined,
          performanceTypes: presets?.performanceTypes || rules.defaultTypes || undefined,
          rawData: { ...event.rawData, scrapedUrl: url },
          importedAt: new Date()
        }).save()
        created++
      }

      return { eventsFound: events.length, eventsCreated: created }
    } catch (err: any) {
      return { error: `Scrape failed: ${err.message}` }
    }
  }
})
