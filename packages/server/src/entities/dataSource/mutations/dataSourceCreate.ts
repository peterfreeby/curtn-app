import { GraphQLString, GraphQLNonNull, GraphQLBoolean } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { dataSourceType } from '../dataSourceTypes'
import { DataSourceModel } from '../dataSourceModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'

export const dataSourceCreate = mutationWithClientMutationId({
  name: 'dataSourceCreate',
  description: 'Create a new data source (admin only)',
  inputFields: {
    name: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Data source name'
    },
    type: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Type: manual, csv, rss, ical, api, or web'
    },
    url: {
      type: GraphQLString,
      description: 'Feed URL (for rss/ical sources)'
    },
    config: {
      type: GraphQLString,
      description: 'Cleanup rules as JSON string'
    },
    associatedVenueId: {
      type: GraphQLString,
      description: 'Optional associated venue ID'
    },
    associatedCompanyId: {
      type: GraphQLString,
      description: 'Optional associated production company ID'
    },
    isActive: {
      type: GraphQLBoolean,
      description: 'Whether the source is active (default true)'
    }
  },
  outputFields: {
    dataSource: {
      type: dataSourceType,
      resolve: response => response.dataSource
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    try {
      const validTypes = ['manual', 'csv', 'rss', 'ical', 'api', 'web']
      if (!validTypes.includes(input.type)) {
        return { error: `Invalid type "${input.type}". Must be one of: ${validTypes.join(', ')}` }
      }

      let config = {}
      if (input.config) {
        try {
          config = JSON.parse(input.config)
        } catch {
          return { error: 'Invalid config JSON' }
        }
      }

      const dataSource = await new DataSourceModel({
        name: input.name.trim(),
        type: input.type,
        url: input.url,
        config,
        associatedVenue: input.associatedVenueId || undefined,
        associatedCompany: input.associatedCompanyId || undefined,
        isActive: input.isActive !== undefined ? input.isActive : true,
        createdBy: ctx.user.id
      }).save()

      return { dataSource }
    } catch (err: any) {
      console.error('dataSourceCreate error:', err)
      return { error: 'Failed to create data source' }
    }
  }
})
