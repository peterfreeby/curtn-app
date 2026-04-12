import { GraphQLString, GraphQLNonNull, GraphQLInt, GraphQLList } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { UserModel } from '../../user/userModel'
import { DataSourceModel } from '../../dataSource/dataSourceModel'
import { PendingImportModel } from '../../pendingImport/pendingImportModel'
import { fetchPage, applyTemplate, applyTemplateV2, isV2Template, ParsingTemplate } from '../../../services/pageFetcher'
import type { V2ParsingTemplate } from '../../../services/pageFetcher'
import { CleanupRules } from '../../../services/feedParser/shared'
import { processImportRows, type ImportResult } from '../../../services/importEngine'

interface Presets {
  venueName?: string
  companyName?: string
  stageName?: string
  performanceTypes?: string[]
}

export const scrapeUrl = mutationWithClientMutationId({
  name: 'scrapeUrl',
  description: 'Scrape a single URL using a data source template and create records',
  inputFields: {
    url: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'URL to scrape'
    },
    dataSourceId: {
      type: GraphQLString,
      description: 'DataSource MongoDB ID (uses its template and presets)'
    },
    template: {
      type: GraphQLString,
      description: 'Parsing template as JSON string (V1 or V2)'
    }
  },
  outputFields: {
    eventsFound: { type: GraphQLInt, resolve: r => r.eventsFound },
    eventsCreated: { type: GraphQLInt, resolve: r => r.eventsCreated },
    // V2 import result stats
    showsCreated: { type: GraphQLInt, resolve: r => r.importResult?.showsCreated },
    showsMatched: { type: GraphQLInt, resolve: r => r.importResult?.showsMatched },
    runsCreated: { type: GraphQLInt, resolve: r => r.importResult?.runsCreated },
    performancesCreated: { type: GraphQLInt, resolve: r => r.importResult?.performancesCreated },
    venuesCreated: { type: GraphQLInt, resolve: r => r.importResult?.venuesCreated },
    personsCreated: { type: GraphQLInt, resolve: r => r.importResult?.personsCreated },
    creditsCreated: { type: GraphQLInt, resolve: r => r.importResult?.creditsCreated },
    importErrors: { type: new GraphQLList(GraphQLString), resolve: r => r.importResult?.errors },
    ...errorField
  },
  mutateAndGetPayload: async ({ url, dataSourceId, template: templateJson }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    let template: any
    let presets: Presets | undefined
    let rules: CleanupRules = {}
    let dsId: any = undefined

    if (dataSourceId) {
      const ds = await DataSourceModel.findById(dataSourceId)
      if (!ds) return { error: 'Data source not found' }
      dsId = ds._id
      template = (ds.config as any)?.parsingTemplate
      presets = (ds.config as any)?.presets
      rules = (ds.config as any) || {}
    }

    if (templateJson) {
      try {
        template = JSON.parse(templateJson)
      } catch {
        return { error: 'Invalid template JSON' }
      }
    }

    if (!template) {
      return { error: 'No parsing template available' }
    }

    try {
      const html = await fetchPage(url)

      // V2 path: extract flat rows → feed directly to promotion engine
      if (isV2Template(template)) {
        const rows = applyTemplateV2(html, template as V2ParsingTemplate, url)
        const validRows = rows.filter(r => r.title?.trim())

        if (validRows.length === 0) {
          return { eventsFound: 0, eventsCreated: 0, error: 'No events with a title found on this page' }
        }

        const importResult = await processImportRows(
          validRows as any[],
          { userId: ctx.user.id, dataSourceId: dsId?.toString() }
        )

        return {
          eventsFound: rows.length,
          eventsCreated: importResult.showsCreated + importResult.showsMatched,
          importResult
        }
      }

      // V1 path: extract ParsedEvents → create PendingImports
      const events = applyTemplate(html, template as ParsingTemplate, url)

      let created = 0
      for (const event of events) {
        if (!event.title?.trim()) continue

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
