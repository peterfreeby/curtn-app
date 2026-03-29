import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId, fromGlobalId } from 'graphql-relay'
import { performanceType } from '../performanceTypes'
import { PerformanceModel } from '../performanceModel'
import { CreditModel } from '../../credit/creditModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'

// Sub out: remove an inherited credit for this performance
export const performanceCreditRemove = mutationWithClientMutationId({
  name: 'performanceCreditRemove',
  description: 'Remove an inherited credit from this specific performance (sub out)',
  inputFields: {
    performanceId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Performance MongoDB ObjectId'
    },
    creditId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Credit MongoDB ObjectId to remove from this performance'
    }
  },
  outputFields: {
    performance: {
      type: performanceType,
      resolve: response => response.performance
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    try {
      const performance = await PerformanceModel.findById(input.performanceId)
      if (!performance) return { error: 'Performance not found' }

      if (!performance.creditOverrides) {
        performance.creditOverrides = { added: [], removed: [] }
      }

      const creditId = input.creditId
      if (!performance.creditOverrides.removed.some((id: any) => id.toString() === creditId)) {
        performance.creditOverrides.removed.push(creditId as any)
      }

      await performance.save()
      return { performance }
    } catch (err) {
      console.error('performanceCreditRemove error:', err)
      return { error: 'Failed to update credit overrides' }
    }
  }
})

// Restore a previously removed credit
export const performanceCreditRestore = mutationWithClientMutationId({
  name: 'performanceCreditRestore',
  description: 'Restore a previously removed credit for this performance',
  inputFields: {
    performanceId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Performance MongoDB ObjectId'
    },
    creditId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Credit MongoDB ObjectId to restore'
    }
  },
  outputFields: {
    performance: {
      type: performanceType,
      resolve: response => response.performance
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    try {
      const performance = await PerformanceModel.findById(input.performanceId)
      if (!performance) return { error: 'Performance not found' }

      if (performance.creditOverrides) {
        performance.creditOverrides.removed = performance.creditOverrides.removed.filter(
          (id: any) => id.toString() !== input.creditId
        )
        await performance.save()
      }

      return { performance }
    } catch (err) {
      console.error('performanceCreditRestore error:', err)
      return { error: 'Failed to restore credit' }
    }
  }
})

// Add a guest credit for this performance only
export const performanceCreditAdd = mutationWithClientMutationId({
  name: 'performanceCreditAdd',
  description: 'Add a credit that only applies to this specific performance (guest, sub-in)',
  inputFields: {
    performanceId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Performance MongoDB ObjectId'
    },
    personName: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Person name (creates new if not found)'
    },
    creditType: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'cast or crew'
    },
    role: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Role name'
    }
  },
  outputFields: {
    performance: {
      type: performanceType,
      resolve: response => response.performance
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    try {
      const performance = await PerformanceModel.findById(input.performanceId)
      if (!performance) return { error: 'Performance not found' }

      // Find or create the person
      const { PersonModel } = require('../../person/personModel')
      const slug = input.personName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      let person = await PersonModel.findOne({ slug })
      if (!person) {
        person = await new PersonModel({
          name: input.personName,
          slug,
          submittedBy: ctx.user.id,
        }).save()
      }

      // Create a credit on the run (so it has an ID the override system can reference)
      const credit = await new CreditModel({
        person: person._id,
        run: performance.run,
        creditType: input.creditType,
        role: input.role,
        submittedBy: ctx.user.id,
      }).save()

      // Add to performance overrides
      if (!performance.creditOverrides) {
        performance.creditOverrides = { added: [], removed: [] }
      }
      performance.creditOverrides.added.push(credit._id)
      await performance.save()

      return { performance }
    } catch (err) {
      console.error('performanceCreditAdd error:', err)
      return { error: 'Failed to add credit' }
    }
  }
})
