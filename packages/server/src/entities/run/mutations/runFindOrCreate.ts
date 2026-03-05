import { GraphQLNonNull, GraphQLString, GraphQLList, GraphQLInt, GraphQLBoolean } from 'graphql'
import { mutationWithClientMutationId, fromGlobalId } from 'graphql-relay'
import { runType } from '../runTypes'
import { RunModel } from '../runModel'
import { errorField } from '../../../graphql/errorField'

export const runFindOrCreate = mutationWithClientMutationId({
  name: 'runFindOrCreate',
  description: 'Find an existing run by show (+ optional production company), or create a new one',
  inputFields: {
    showId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Show global ID'
    },
    productionCompanyId: {
      type: GraphQLString,
      description: 'Production company global ID (optional)'
    },
    venueIds: {
      type: new GraphQLList(GraphQLString),
      description: 'Venue global IDs'
    },
    intermissions: {
      type: GraphQLInt,
      description: 'Number of intermissions'
    },
    startDate: {
      type: GraphQLString,
      description: 'Run start date (ISO)'
    },
    endDate: {
      type: GraphQLString,
      description: 'Run end date (ISO)'
    },
    description: {
      type: GraphQLString,
      description: 'Run description'
    }
  },
  outputFields: {
    run: {
      type: runType,
      resolve: response => response.run
    },
    created: {
      type: GraphQLBoolean,
      resolve: response => response.created
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) {
      return { error: 'Unauthorized', run: null, created: false }
    }

    try {
      const showObjectId = fromGlobalId(input.showId).id
      const companyObjectId = input.productionCompanyId
        ? fromGlobalId(input.productionCompanyId).id
        : undefined
      const venueObjectIds = (input.venueIds || []).map((vid: string) => fromGlobalId(vid).id)

      // Build find query — match on show, and on company if provided
      const findQuery: any = { show: showObjectId }
      if (companyObjectId) {
        findQuery.productionCompany = companyObjectId
      } else {
        // If no company provided, match runs that also have no company
        findQuery.$or = [
          { productionCompany: { $exists: false } },
          { productionCompany: null }
        ]
      }

      const existing = await RunModel.findOne(findQuery)

      if (existing) {
        // Merge new venue IDs into existing venues array
        if (venueObjectIds.length > 0) {
          const currentVenueStrings = existing.venues.map(v => v.toString())
          const newVenues = venueObjectIds.filter((v: string) => !currentVenueStrings.includes(v))
          if (newVenues.length > 0) {
            existing.venues.push(...newVenues)
            await existing.save()
          }
        }
        return { run: existing, created: false }
      }

      const run = await new RunModel({
        show: showObjectId,
        productionCompany: companyObjectId,
        venues: venueObjectIds,
        intermissions: input.intermissions || 0,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        description: input.description,
        submittedBy: ctx.user.id
      }).save()

      return { run, created: true }
    } catch (err) {
      console.error('runFindOrCreate error:', err)
      return { error: 'Failed to find or create run' }
    }
  }
})
