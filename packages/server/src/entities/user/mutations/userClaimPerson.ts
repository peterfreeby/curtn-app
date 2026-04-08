import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { userType } from '../userTypes'

export const userClaimPerson = mutationWithClientMutationId({
  name: 'userClaimPerson',
  description: 'Deprecated — use submitClaimRequest instead. Claims now require admin approval.',
  inputFields: {
    personId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Global ID of the Person to claim'
    }
  },
  mutateAndGetPayload: async () => {
    return { error: 'Direct claims are no longer supported. Use submitClaimRequest instead.' }
  },
  outputFields: {
    ...errorField,
    user: {
      type: userType,
      resolve: (response: any) => response.user
    }
  }
})
