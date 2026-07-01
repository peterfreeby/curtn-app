import { GraphQLBoolean, GraphQLFieldConfig } from 'graphql'
import { EntityFollowModel, EntityFollowTargetType } from './entityFollowModel'

/**
 * Builds an `isFollowedByViewer` GraphQL field for an entity type.
 * Resolves whether the current viewer follows this entity (via EntityFollow).
 */
export function isFollowedByViewerField (targetType: EntityFollowTargetType): GraphQLFieldConfig<any, any> {
  return {
    type: GraphQLBoolean,
    description: 'Whether the current viewer follows this entity',
    resolve: async (entity: any, _args: any, ctx: any) => {
      if (!ctx.user) return false
      const doc = await EntityFollowModel.findOne({
        follower: ctx.user.id,
        targetType,
        targetId: entity._id
      })
      return !!doc
    }
  }
}
