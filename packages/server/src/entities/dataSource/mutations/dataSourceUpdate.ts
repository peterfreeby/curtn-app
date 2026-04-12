import { GraphQLString, GraphQLNonNull, GraphQLBoolean } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { dataSourceType } from '../dataSourceTypes'
import { DataSourceModel } from '../dataSourceModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'

export const dataSourceUpdate = mutationWithClientMutationId({
  name: 'dataSourceUpdate',
  description: 'Update an existing data source (admin only)',
  inputFields: {
    dataSourceId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'DataSource MongoDB ID'
    },
    name: {
      type: GraphQLString,
      description: 'Updated name'
    },
    url: {
      type: GraphQLString,
      description: 'Updated feed URL'
    },
    config: {
      type: GraphQLString,
      description: 'Updated config as JSON string'
    },
    isActive: {
      type: GraphQLBoolean,
      description: 'Whether the source is active'
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
      const ds = await DataSourceModel.findById(input.dataSourceId)
      if (!ds) return { error: 'Data source not found' }

      if (input.name !== undefined) {
        ds.name = input.name.trim()
      }

      if (input.url !== undefined) {
        ds.url = input.url
      }

      if (input.config !== undefined) {
        try {
          ds.config = JSON.parse(input.config)
        } catch {
          return { error: 'Invalid config JSON' }
        }
      }

      if (input.isActive !== undefined) {
        ds.isActive = input.isActive
      }

      await ds.save()
      return { dataSource: ds }
    } catch (err: any) {
      console.error('dataSourceUpdate error:', err)
      return { error: 'Failed to update data source' }
    }
  }
})
