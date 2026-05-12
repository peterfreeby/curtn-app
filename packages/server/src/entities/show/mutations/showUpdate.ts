import { GraphQLNonNull, GraphQLString, GraphQLInt } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { showType } from '../showTypes'
import { ShowModel } from '../showModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'
import { writeAuditLog } from '../../../services/auditLog/writeAuditLog'

export const showUpdate = mutationWithClientMutationId({
  name: 'showUpdate',
  description: 'Update an existing show (admin only)',
  inputFields: {
    showId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the show to update'
    },
    expectedUpdatedAt: {
      type: GraphQLString,
      description: 'Optimistic concurrency token. ISO string of updatedAt at edit-form load time.'
    },
    title: {
      type: GraphQLString,
      description: 'Show title'
    },
    description: {
      type: GraphQLString,
      description: 'Show description'
    },
    performanceTypes: {
      type: GraphQLString,
      description: 'Comma-separated performance types'
    },
    duration: {
      type: GraphQLString,
      description: 'Duration in minutes (string, parsed to int)'
    },
    url: {
      type: GraphQLString,
      description: 'External URL for the show'
    },
    imageUrl: {
      type: GraphQLString,
      description: 'Image URL (from Vercel Blob)'
    },
    posterUrl: {
      type: GraphQLString,
      description: 'Poster URL — portrait poster image (from Vercel Blob)'
    }
  },
  outputFields: {
    show: {
      type: showType,
      resolve: response => response.show
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    try {
      const show = await ShowModel.findById(input.showId)
      if (!show) return { error: 'Show not found' }

      if (input.expectedUpdatedAt) {
        const submitted = new Date(input.expectedUpdatedAt).getTime()
        const current = (show as any).updatedAt?.getTime() ?? 0
        if (current > submitted) {
          return { error: `STALE_VERSION: record changed at ${(show as any).updatedAt?.toISOString()}` }
        }
      }

      const updates: Record<string, any> = {}

      if (input.title !== undefined) updates.title = input.title
      if (input.description !== undefined) updates.description = input.description
      if (input.performanceTypes !== undefined) {
        updates.performanceTypes = input.performanceTypes.split(',').map((s: string) => s.trim()).filter(Boolean)
      }
      if (input.duration !== undefined && input.duration !== '') updates.duration = parseInt(input.duration, 10) || 0
      if (input.url !== undefined) updates.url = input.url
      if (input.imageUrl !== undefined && input.imageUrl !== '') updates.imageUrl = input.imageUrl
      if (input.posterUrl !== undefined && input.posterUrl !== '') updates.posterUrl = input.posterUrl

      if (Object.keys(updates).length === 0) {
        return { show }
      }

      const oldDoc = show.toObject()
      const updated = await ShowModel.findByIdAndUpdate(input.showId, updates, { new: true })
      if (updated) {
        await writeAuditLog({
          target: { kind: 'Show', id: updated._id },
          author: { kind: 'User', userId: ctx.user.id },
          oldDoc,
          newDoc: updated.toObject(),
          approvalSource: 'admin-override',
        })
      }
      return { show: updated }
    } catch (err) {
      console.error('showUpdate error:', err)
      return { error: 'Failed to update show' }
    }
  }
})
