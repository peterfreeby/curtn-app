import { Types } from 'mongoose'
import { EntityFollowModel } from '../entityFollow/entityFollowModel'
import { showsForEntities, DEFAULT_DYNAMIC_LIMIT } from './dynamicListItems'

/**
 * Resolves the show documents for a dynamic list.
 *  - entity:  shows from the single configured source entity
 *  - follows: shows from every entity of `followTargetType` the viewer follows
 * Returns [] when the source is unset or (for follows) the viewer follows nothing,
 * which causes the list to disappear from the browse page.
 */
export async function resolveDynamicListItems (list: any, ctx: any): Promise<any[]> {
  if (list.sourceMode === 'entity') {
    if (!list.sourceEntityType || !list.sourceEntityId) return []
    return showsForEntities(list.sourceEntityType, [list.sourceEntityId], DEFAULT_DYNAMIC_LIMIT)
  }

  if (list.sourceMode === 'follows') {
    if (!list.followTargetType || !ctx?.user) return []
    const follows = await EntityFollowModel.find({
      follower: ctx.user.id,
      targetType: list.followTargetType
    }).select('targetId').lean()
    const targetIds = follows.map((f: any) => f.targetId as Types.ObjectId)
    if (targetIds.length === 0) return []
    return showsForEntities(list.followTargetType, targetIds, DEFAULT_DYNAMIC_LIMIT)
  }

  return []
}
