import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLID,
  GraphQLNonNull
} from 'graphql'
import {
  fromGlobalId,
  mutationWithClientMutationId
} from 'graphql-relay'
import { EntityFollowModel, ENTITY_FOLLOW_TARGET_TYPES, EntityFollowTargetType } from '../entityFollowModel'
import { errorField } from '../../../graphql/errorField'
import { VenueModel } from '../../venue/venueModel'
import { PersonModel } from '../../person/personModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'

export const entityFollowTargetTypeEnum = new GraphQLEnumType({
  name: 'EntityFollowTargetType',
  description: 'Kind of entity that can be followed',
  values: {
    venue: { value: 'venue' },
    person: { value: 'person' },
    productionCompany: { value: 'productionCompany' }
  }
})

const modelFor: Record<EntityFollowTargetType, { exists: (id: string) => Promise<boolean> }> = {
  venue: { exists: async id => !!(await VenueModel.exists({ _id: id })) },
  person: { exists: async id => !!(await PersonModel.exists({ _id: id })) },
  productionCompany: { exists: async id => !!(await ProductionCompanyModel.exists({ _id: id })) }
}

export const entityFollowToggle = mutationWithClientMutationId({
  name: 'entityFollowToggle',
  description: 'Toggle follow/unfollow an entity (venue, person, or production company)',
  inputFields: {
    targetType: {
      type: new GraphQLNonNull(entityFollowTargetTypeEnum),
      description: 'The kind of entity to follow/unfollow'
    },
    targetId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'The global ID of the entity to follow/unfollow'
    }
  },
  outputFields: {
    isFollowing: {
      type: GraphQLBoolean,
      resolve: response => response.isFollowing
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ targetType, targetId }, ctx) => {
    if (!ctx.user) {
      return { isFollowing: false, error: 'Unauthorized' }
    }

    if (!ENTITY_FOLLOW_TARGET_TYPES.includes(targetType)) {
      return { isFollowing: false, error: 'Invalid target type' }
    }

    const { id: decodedId } = fromGlobalId(targetId)
    const followerId = ctx.user.id

    const exists = await modelFor[targetType as EntityFollowTargetType].exists(decodedId)
    if (!exists) {
      return { isFollowing: false, error: 'Entity not found' }
    }

    const existing = await EntityFollowModel.findOne({
      follower: followerId,
      targetType,
      targetId: decodedId
    })

    if (existing) {
      await EntityFollowModel.deleteOne({ _id: existing._id })
      return { isFollowing: false }
    }

    await new EntityFollowModel({
      follower: followerId,
      targetType,
      targetId: decodedId
    }).save()

    return { isFollowing: true }
  }
})
