import { GraphQLString, GraphQLNonNull, GraphQLBoolean, GraphQLInt, GraphQLObjectType, GraphQLList } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { UserModel } from '../../user/userModel'
import { fetchPage, applyTemplate, extractJsonLd, ParsingTemplate } from '../../../services/pageFetcher'

const parsedCreditType = new GraphQLObjectType({
  name: 'TestParsedCredit',
  fields: () => ({
    name: { type: GraphQLString },
    role: { type: GraphQLString },
    headshotUrl: { type: GraphQLString }
  })
})

const parsedEventType = new GraphQLObjectType({
  name: 'TestParsedEvent',
  fields: () => ({
    title: { type: GraphQLString },
    description: { type: GraphQLString },
    date: { type: GraphQLString, resolve: e => e.date?.toISOString?.() ?? e.date },
    time: { type: GraphQLString },
    venue: { type: GraphQLString, resolve: e => e.rawData?.venue },
    ticketUrl: { type: GraphQLString },
    imageUrl: { type: GraphQLString, resolve: e => e.imageUrl },
    price: { type: GraphQLString, resolve: e => e.rawData?.price },
    runTitle: { type: GraphQLString },
    showDescription: { type: GraphQLString },
    runDescription: { type: GraphQLString },
    duration: { type: GraphQLInt },
    startDate: { type: GraphQLString, resolve: e => e.startDate?.toISOString?.() ?? e.startDate },
    endDate: { type: GraphQLString, resolve: e => e.endDate?.toISOString?.() ?? e.endDate },
    credits: { type: new GraphQLList(parsedCreditType) }
  })
})

export const testParsingTemplate = mutationWithClientMutationId({
  name: 'testParsingTemplate',
  description: 'Test a parsing template against a URL without creating imports',
  inputFields: {
    url: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'URL of the page to test against'
    },
    template: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Parsing template as JSON string'
    }
  },
  outputFields: {
    events: {
      type: new GraphQLList(parsedEventType),
      resolve: r => r.events
    },
    jsonLdDetected: {
      type: GraphQLBoolean,
      resolve: r => r.jsonLdDetected
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ url, template: templateJson }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    let template: ParsingTemplate
    try {
      template = JSON.parse(templateJson)
    } catch {
      return { error: 'Invalid template JSON' }
    }

    if (!template.selectors?.title?.selector && !template.useJsonLd) {
      return { error: 'Template must have at least a title selector or useJsonLd enabled' }
    }

    try {
      const html = await fetchPage(url)

      // Check for JSON-LD presence regardless of template setting
      const jsonLdEvents = extractJsonLd(html)
      const jsonLdDetected = jsonLdEvents.length > 0

      const events = applyTemplate(html, template, url)

      // Cap results
      return {
        events: events.slice(0, 20),
        jsonLdDetected
      }
    } catch (err: any) {
      return { error: `Page fetch failed: ${err.message}` }
    }
  }
})
