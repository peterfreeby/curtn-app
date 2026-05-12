import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { canPerform } from '../../../permissions/canPerform'
import { writeAuditLog } from '../../../services/auditLog/writeAuditLog'
import { AuditLogModel, AuditTargetKind } from '../auditLogModel'
import { auditLogType } from '../auditLogTypes'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../person/personModel'
import { ShowModel } from '../../show/showModel'
import { RunModel } from '../../run/runModel'
import { PerformanceModel } from '../../performance/performanceModel'
import { StageModel } from '../../stage/stageModel'
import { UserModel } from '../../user/userModel'

// Maps an AuditLog target.kind → its Mongoose model.
function modelForKind(kind: AuditTargetKind) {
  switch (kind) {
    case 'Venue': return VenueModel
    case 'ProductionCompany': return ProductionCompanyModel
    case 'Person': return PersonModel
    case 'Show': return ShowModel
    case 'Run': return RunModel
    case 'Performance': return PerformanceModel
    case 'Stage': return StageModel
    default: return null
  }
}

// Maps target.kind → the canPerform UnitKind for the gate. Show/Run/Stage
// aren't claimable units in Phase 1 — only admins can revert those.
function canPerformKindFor(kind: AuditTargetKind): 'Venue' | 'ProductionCompany' | 'Person' | 'Performance' | null {
  if (kind === 'Venue' || kind === 'ProductionCompany' || kind === 'Person' || kind === 'Performance') return kind
  return null
}

function actionIdFor(kind: AuditTargetKind) {
  switch (kind) {
    case 'Venue': return 'venue.edit_description'
    case 'ProductionCompany': return 'company.edit_description'
    case 'Person': return 'person.edit_bio'
    case 'Performance': return 'performance.edit_date_time'
    default: return null
  }
}

export const revertAuditLogEntry = mutationWithClientMutationId({
  name: 'revertAuditLogEntry',
  description: 'Revert a prior edit by applying the inverse diff. Writes a new AuditLog row (isRevert=true).',
  inputFields: {
    auditLogEntryId: { type: new GraphQLNonNull(GraphQLString) }
  },
  outputFields: {
    auditLogEntry: {
      type: auditLogType,
      resolve: (r: any) => r.auditLogEntry
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ auditLogEntryId }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    const original = await AuditLogModel.findById(auditLogEntryId)
    if (!original) return { error: 'Audit log entry not found' }

    if (original.isRevert === false && original.diff?._created === true) {
      return { error: 'Cannot revert a creation entry' }
    }

    const kind = original.target.kind as AuditTargetKind
    const Model: any = modelForKind(kind)
    if (!Model) return { error: `Unsupported target kind: ${kind}` }

    // Permission check. For claimable units use canPerform; for the rest
    // (Show / Run / Stage), require admin since Phase 1 doesn't have a
    // claimant concept for them.
    const cpKind = canPerformKindFor(kind)
    const cpAction = actionIdFor(kind)
    if (cpKind && cpAction) {
      const decision = await canPerform(ctx.user.id, cpAction as any, {
        kind: cpKind,
        id: original.target.id as any,
      })
      if (decision.mode !== 'auto-publish') {
        return { error: decision.reason || 'Permission denied' }
      }
    } else {
      const adminUser = await UserModel.findById(ctx.user.id)
      if (!adminUser?.isAdmin) return { error: 'Admin access required' }
    }

    const target = await Model.findById(original.target.id)
    if (!target) return { error: 'Target record not found' }

    // Compute the inverse diff and apply it directly to the target.
    const diff = original.diff || {}
    const updates: Record<string, any> = {}
    for (const key of Object.keys(diff)) {
      if (key === '_created' || key === 'snapshot' || key === '_hidden') continue
      const entry = diff[key]
      if (entry && typeof entry === 'object' && 'old' in entry) {
        updates[key] = entry.old
      }
    }

    if (Object.keys(updates).length === 0) {
      return { error: 'Nothing to revert' }
    }

    const oldDoc = target.toObject()
    const updated = await Model.findByIdAndUpdate(target._id, updates, { new: true })
    if (!updated) return { error: 'Revert failed: target update returned null' }

    const approvalSource = cpKind ? 'direct-publish' : 'admin-override'

    const newEntry = await writeAuditLog({
      target: { kind, id: updated._id },
      author: { kind: 'User', userId: ctx.user.id },
      oldDoc,
      newDoc: updated.toObject(),
      approvalSource: approvalSource as any,
      isRevert: true,
      revertOf: original._id,
    })

    return { auditLogEntry: newEntry }
  }
})
