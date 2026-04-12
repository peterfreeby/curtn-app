import { GraphQLString, GraphQLNonNull } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { DataSourceModel } from '../dataSourceModel'
import { UserModel } from '../../user/userModel'
import { PendingImportModel } from '../../pendingImport/pendingImportModel'
import { errorField } from '../../../graphql/errorField'

export const dataSourceDelete = mutationWithClientMutationId({
  name: 'dataSourceDelete',
  description: 'Delete a data source and its pending imports (admin only)',
  inputFields: {
    dataSourceId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'DataSource MongoDB ID'
    }
  },
  outputFields: {
    deletedId: {
      type: GraphQLString,
      resolve: r => r.deletedId
    },
    pendingImportsRemoved: {
      type: GraphQLString,
      resolve: r => r.pendingImportsRemoved
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ dataSourceId }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    try {
      const ds = await DataSourceModel.findById(dataSourceId)
      if (!ds) return { error: 'Data source not found' }

      // Remove pending imports from this source
      const result = await PendingImportModel.deleteMany({ dataSource: ds._id })

      await DataSourceModel.findByIdAndDelete(dataSourceId)

      return {
        deletedId: dataSourceId,
        pendingImportsRemoved: String(result.deletedCount)
      }
    } catch (err: any) {
      console.error('dataSourceDelete error:', err)
      return { error: 'Failed to delete data source' }
    }
  }
})
