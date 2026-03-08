import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { runType } from '../runTypes'
import { RunModel } from '../runModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'

export const runUpdate = mutationWithClientMutationId({
  name: 'runUpdate',
  description: 'Update an existing run (admin only)',
  inputFields: {
    runId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the run to update'
    },
    title: {
      type: GraphQLString,
      description: 'Run-specific title'
    },
    description: {
      type: GraphQLString,
      description: 'Run description'
    },
    intermissions: {
      type: GraphQLString,
      description: 'Number of intermissions (string, parsed to int)'
    },
    startDate: {
      type: GraphQLString,
      description: 'Start date (ISO string)'
    },
    endDate: {
      type: GraphQLString,
      description: 'End date (ISO string)'
    },
    imageUrl: {
      type: GraphQLString,
      description: 'Image URL (from Vercel Blob)'
    }
  },
  outputFields: {
    run: {
      type: runType,
      resolve: response => response.run
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    try {
      const run = await RunModel.findById(input.runId)
      if (!run) return { error: 'Run not found' }

      const updates: Record<string, any> = {}

      if (input.title !== undefined) updates.title = input.title
      if (input.description !== undefined) updates.description = input.description
      if (input.intermissions !== undefined && input.intermissions !== '') updates.intermissions = parseInt(input.intermissions, 10) || 0
      if (input.startDate !== undefined && input.startDate !== '') updates.startDate = new Date(input.startDate)
      if (input.endDate !== undefined && input.endDate !== '') updates.endDate = new Date(input.endDate)
      if (input.imageUrl !== undefined && input.imageUrl !== '') updates.imageUrl = input.imageUrl

      if (Object.keys(updates).length === 0) {
        return { run }
      }

      const updated = await RunModel.findByIdAndUpdate(input.runId, updates, { new: true })
      return { run: updated }
    } catch (err) {
      console.error('runUpdate error:', err)
      return { error: 'Failed to update run' }
    }
  }
})
