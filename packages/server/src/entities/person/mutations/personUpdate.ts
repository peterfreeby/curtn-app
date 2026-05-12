import { GraphQLBoolean, GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { personType } from '../personTypes'
import { PersonModel } from '../personModel'
import { errorField } from '../../../graphql/errorField'
import { canPerform } from '../../../permissions/canPerform'
import { bumpForUnit } from '../../../services/claims/bumpClaimantActivity'
import { writeAuditLog } from '../../../services/auditLog/writeAuditLog'
import { createProposal } from '../../proposal/mutations/createProposal'
import { computeUpdateDiff } from '../../../services/proposalDiff/computeUpdateDiff'

export const personUpdate = mutationWithClientMutationId({
  name: 'personUpdate',
  description: 'Update an existing person (admin or claimant)',
  inputFields: {
    personId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the person to update'
    },
    expectedUpdatedAt: {
      type: GraphQLString,
      description: 'Optimistic concurrency token. ISO string of updatedAt at edit-form load time.'
    },
    name: {
      type: GraphQLString,
      description: 'Person name'
    },
    bio: {
      type: GraphQLString,
      description: 'Biography'
    },
    headshotUrl: {
      type: GraphQLString,
      description: 'Headshot image URL (from Vercel Blob)'
    },
    wikidataId: {
      type: GraphQLString,
      description: 'Wikidata ID'
    }
  },
  outputFields: {
    person: {
      type: personType,
      resolve: response => response.person
    },
    queued: {
      type: GraphQLBoolean,
      resolve: response => !!response.queued
    },
    proposalId: {
      type: GraphQLString,
      resolve: response => response.proposalId ?? null
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    // Phase 5 TODO: switch to per-field action mapping once trusted-editor scope is wired.
    const decision = await canPerform(ctx.user.id, 'person.edit_bio', {
      kind: 'Person',
      id: input.personId
    })
    if (decision.mode === 'denied') {
      return { error: decision.reason || 'Permission denied' }
    }

    try {
      const person = await PersonModel.findById(input.personId)
      if (!person) return { error: 'Person not found' }

      if (input.expectedUpdatedAt) {
        const submitted = new Date(input.expectedUpdatedAt).getTime()
        const current = person.updatedAt?.getTime() ?? 0
        if (current > submitted) {
          return { error: `STALE_VERSION: record changed at ${person.updatedAt?.toISOString()}` }
        }
      }

      const updates: Record<string, any> = {}

      if (input.name !== undefined) {
        updates.name = input.name
        // Regenerate slug when name changes
        updates.slug = input.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      }
      if (input.bio !== undefined) updates.bio = input.bio
      if (input.headshotUrl !== undefined && input.headshotUrl !== '') updates.headshotUrl = input.headshotUrl
      if (input.wikidataId !== undefined) updates.wikidataId = input.wikidataId

      if (Object.keys(updates).length === 0) {
        return { person }
      }

      if (decision.mode === 'queue') {
        const diff = computeUpdateDiff(person.toObject(), updates)
        if (Object.keys(diff).length === 0) return { person }
        const result = await createProposal({
          target: { kind: 'Person', id: person._id },
          proposer: { kind: 'User', userId: ctx.user.id, label: ctx.user.username },
          diff,
          submissionVersion: person.updatedAt,
        })
        return { queued: true, proposalId: result.proposalId, person }
      }

      const oldDoc = person.toObject()
      const updated = await PersonModel.findByIdAndUpdate(input.personId, updates, { new: true })
      if (updated) {
        await writeAuditLog({
          target: { kind: 'Person', id: updated._id },
          author: { kind: 'User', userId: ctx.user.id },
          oldDoc,
          newDoc: updated.toObject(),
          approvalSource: 'direct-publish',
        })
        if (updated.claimedBy?.toString() === ctx.user.id) {
          await bumpForUnit('person', updated._id)
        }
      }
      return { person: updated }
    } catch (err) {
      console.error('personUpdate error:', err)
      return { error: 'Failed to update person' }
    }
  }
})
