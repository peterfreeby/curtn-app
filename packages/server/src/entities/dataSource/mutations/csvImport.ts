import {
  GraphQLString,
  GraphQLNonNull,
  GraphQLList,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLInputObjectType,
  GraphQLBoolean
} from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { UserModel } from '../../user/userModel'
import { processImportRows } from '../../../services/importEngine'

const CsvRowInput = new GraphQLInputObjectType({
  name: 'CsvRowInput',
  fields: {
    // Show fields
    title: { type: new GraphQLNonNull(GraphQLString) },
    showDescription: { type: GraphQLString },
    performanceTypes: { type: GraphQLString },    // comma-separated
    duration: { type: GraphQLString },             // minutes as string
    showUrl: { type: GraphQLString },              // show website
    showImageUrl: { type: GraphQLString },         // show backdrop/cover image URL
    showPosterUrl: { type: GraphQLString },        // show portrait poster URL
    languages: { type: GraphQLString },            // comma-separated

    // Venue fields
    venueName: { type: GraphQLString },
    stageName: { type: GraphQLString },
    venueDescription: { type: GraphQLString },
    venueAddress: { type: GraphQLString },
    venueCity: { type: GraphQLString },            // NYC, Minneapolis, LA
    venueState: { type: GraphQLString },           // NY, MN, CA
    venueZipCode: { type: GraphQLString },
    venueCapacity: { type: GraphQLString },        // number as string
    venueType: { type: GraphQLString },            // theater, concert-hall, etc.
    venueWebsite: { type: GraphQLString },
    venuePhone: { type: GraphQLString },
    venueEmail: { type: GraphQLString },
    venueImageUrl: { type: GraphQLString },

    // Run fields
    runTitle: { type: GraphQLString },
    runDescription: { type: GraphQLString },
    runStartDate: { type: GraphQLString },
    runEndDate: { type: GraphQLString },
    intermissions: { type: GraphQLString },        // number as string
    runImageUrl: { type: GraphQLString },
    runPosterUrl: { type: GraphQLString },

    // Performance fields
    date: { type: GraphQLString },                 // ISO date or parseable date string
    time: { type: GraphQLString },                 // e.g. "7:30 PM"
    startTime: { type: GraphQLString },            // alias for time
    endTime: { type: GraphQLString },              // used to infer duration
    ticketUrl: { type: GraphQLString },
    performanceDescription: { type: GraphQLString },
    soldOut: { type: GraphQLString },              // "true", "yes", "1"

    // Company fields
    companyName: { type: GraphQLString },
    companyDescription: { type: GraphQLString },
    companyLogoUrl: { type: GraphQLString },

    // Performance image
    performanceImageUrl: { type: GraphQLString },  // performance-specific image

    // Person fields
    personHeadshotUrl: { type: GraphQLString },    // person headshot image

    // Credit fields
    personName: { type: GraphQLString },
    personRole: { type: GraphQLString },           // e.g. "Hamlet", "Director", "Playwright"
    creditType: { type: GraphQLString },           // cast, crew, or creator (show-level)
    creditDepartment: { type: GraphQLString },     // cast, crew, creative, production, music

    // List fields
    listName: { type: GraphQLString },             // name of the list to add this entity to
    listType: { type: GraphQLString },             // shows, venues, runs, performances, people
    listDescription: { type: GraphQLString },      // description for the list (used on create)
    listItemNote: { type: GraphQLString },         // optional note on this list item
  }
})

const ImportResultType = new GraphQLObjectType({
  name: 'CsvImportResult',
  fields: {
    totalRows: { type: GraphQLInt },
    showsCreated: { type: GraphQLInt },
    showsMatched: { type: GraphQLInt },
    runsCreated: { type: GraphQLInt },
    runsMatched: { type: GraphQLInt },
    performancesCreated: { type: GraphQLInt },
    performancesMatched: { type: GraphQLInt },
    venuesCreated: { type: GraphQLInt },
    venuesMatched: { type: GraphQLInt },
    companiesCreated: { type: GraphQLInt },
    companiesMatched: { type: GraphQLInt },
    personsCreated: { type: GraphQLInt },
    personsMatched: { type: GraphQLInt },
    creditsCreated: { type: GraphQLInt },
    listsCreated: { type: GraphQLInt },
    listsMatched: { type: GraphQLInt },
    listItemsAdded: { type: GraphQLInt },
    errors: { type: new GraphQLList(GraphQLString) }
  }
})

export const csvImport = mutationWithClientMutationId({
  name: 'csvImport',
  description: 'Bulk import performances from CSV data',
  inputFields: {
    rows: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(CsvRowInput)))
    },
    dataSourceId: {
      type: GraphQLString,
      description: 'Optional DataSource ID to tag imported data'
    },
    dryRun: {
      type: GraphQLBoolean,
      description: 'If true, preview results without creating anything'
    }
  },
  outputFields: {
    result: {
      type: ImportResultType,
      resolve: r => r.result
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ rows, dataSourceId, dryRun }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    const result = await processImportRows(
      rows,
      { userId: ctx.user.id, dataSourceId },
      { dryRun }
    )

    return { result }
  }
})
