import { GraphQLBoolean, GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { productionCompanyType } from '../productionCompanyTypes'
import { ProductionCompanyModel } from '../productionCompanyModel'
import { errorField } from '../../../graphql/errorField'
import { canPerform } from '../../../permissions/canPerform'
import { bumpForUnit } from '../../../services/claims/bumpClaimantActivity'
import { writeAuditLog } from '../../../services/auditLog/writeAuditLog'
import { createProposal } from '../../proposal/mutations/createProposal'
import { computeUpdateDiff } from '../../../services/proposalDiff/computeUpdateDiff'

export const productionCompanyUpdate = mutationWithClientMutationId({
  name: 'productionCompanyUpdate',
  description: 'Update an existing production company (admin or claimant)',
  inputFields: {
    productionCompanyId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the production company to update'
    },
    expectedUpdatedAt: {
      type: GraphQLString,
      description: 'Optimistic concurrency token. ISO string of updatedAt at edit-form load time.'
    },
    name: {
      type: GraphQLString,
      description: 'Company name'
    },
    description: {
      type: GraphQLString,
      description: 'Company description'
    },
    logoUrl: {
      type: GraphQLString,
      description: 'Logo URL'
    },
    wikidataId: {
      type: GraphQLString,
      description: 'Wikidata ID'
    }
  },
  outputFields: {
    productionCompany: {
      type: productionCompanyType,
      resolve: response => response.productionCompany
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
    const decision = await canPerform(ctx.user.id, 'company.edit_description', {
      kind: 'ProductionCompany',
      id: input.productionCompanyId
    })
    if (decision.mode === 'denied') {
      return { error: decision.reason || 'Permission denied' }
    }

    try {
      const company = await ProductionCompanyModel.findById(input.productionCompanyId)
      if (!company) return { error: 'Production company not found' }

      if (input.expectedUpdatedAt) {
        const submitted = new Date(input.expectedUpdatedAt).getTime()
        const current = company.updatedAt?.getTime() ?? 0
        if (current > submitted) {
          return { error: `STALE_VERSION: record changed at ${company.updatedAt?.toISOString()}` }
        }
      }

      const updates: Record<string, any> = {}

      if (input.name !== undefined) {
        updates.name = input.name
        updates.slug = input.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      }
      if (input.description !== undefined) updates.description = input.description
      if (input.logoUrl !== undefined && input.logoUrl !== '') updates.logoUrl = input.logoUrl
      if (input.wikidataId !== undefined) updates.wikidataId = input.wikidataId

      if (Object.keys(updates).length === 0) {
        return { productionCompany: company }
      }

      if (decision.mode === 'queue') {
        const diff = computeUpdateDiff(company.toObject(), updates)
        if (Object.keys(diff).length === 0) return { productionCompany: company }
        const result = await createProposal({
          target: { kind: 'ProductionCompany', id: company._id },
          proposer: { kind: 'User', userId: ctx.user.id, label: ctx.user.username },
          diff,
          submissionVersion: company.updatedAt,
        })
        return { queued: true, proposalId: result.proposalId, productionCompany: company }
      }

      const oldDoc = company.toObject()
      const updated = await ProductionCompanyModel.findByIdAndUpdate(input.productionCompanyId, updates, { new: true })
      if (updated) {
        await writeAuditLog({
          target: { kind: 'ProductionCompany', id: updated._id },
          author: { kind: 'User', userId: ctx.user.id },
          oldDoc,
          newDoc: updated.toObject(),
          approvalSource: 'direct-publish',
        })
        if (updated.claimedBy?.toString() === ctx.user.id) {
          await bumpForUnit('productionCompany', updated._id)
        }
      }
      return { productionCompany: updated }
    } catch (err) {
      console.error('productionCompanyUpdate error:', err)
      return { error: 'Failed to update production company' }
    }
  }
})
