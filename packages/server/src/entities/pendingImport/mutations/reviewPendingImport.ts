import { GraphQLString, GraphQLNonNull, GraphQLList, GraphQLInt, GraphQLBoolean } from 'graphql'
import { mutationWithClientMutationId, fromGlobalId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { UserModel } from '../../user/userModel'
import { PendingImportModel } from '../pendingImportModel'
import { pendingImportType } from '../pendingImportTypes'
import { ShowModel } from '../../show/showModel'
import { RunModel } from '../../run/runModel'
import { PerformanceModel } from '../../performance/performanceModel'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../person/personModel'
import { CreditModel } from '../../credit/creditModel'
import { ensureDefaultStage } from '../../stage/ensureDefaultStage'
import { StageModel } from '../../stage/stageModel'

/**
 * Promotes a pending import into real Show/Run/Performance records.
 * Same find-or-create chain as CSV import.
 */
async function promoteToRecords(pi: any, userId: string) {
  // 1. Find or create Show
  const titleRegex = new RegExp(`^${pi.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
  let show = await ShowModel.findOne({ title: titleRegex })
  if (!show) {
    show = await new ShowModel({
      title: pi.title,
      description: pi.showDescription || '',
      performanceTypes: pi.performanceTypes || [],
      duration: pi.duration || 0,
      ...(pi.imageUrl && { imageUrl: pi.imageUrl }),
      submittedBy: userId,
      source: pi.dataSource
    }).save()
  }

  // 2. Find or create Venue
  let venueIds: string[] = []
  let stageId: string | undefined
  if (pi.venueName?.trim()) {
    const venueSlug = pi.venueName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    let venue = await VenueModel.findOne({ slug: venueSlug })
    if (!venue) {
      venue = await new VenueModel({
        name: pi.venueName.trim(),
        slug: venueSlug,
        address: 'TBD',
        city: 'NYC',
        state: 'NY',
        coordinates: { lat: 40.7128, lng: -74.0060 },
        submittedBy: userId
      }).save()
    }
    venueIds = [venue._id.toString()]
    const defaultStage = await ensureDefaultStage(venue._id, userId as any)

    if (pi.stageName?.trim()) {
      const stageSlug = pi.stageName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      let stage = await StageModel.findOne({ venue: venue._id, slug: stageSlug })
      if (!stage) {
        stage = await new StageModel({
          name: pi.stageName.trim(),
          slug: stageSlug,
          venue: venue._id,
          isDefault: false,
          submittedBy: userId
        }).save()
      }
      stageId = stage._id.toString()
    } else {
      stageId = defaultStage._id.toString()
    }
  }

  // 3. Find or create Company
  let companyId: string | undefined
  if (pi.companyName?.trim()) {
    const companySlug = pi.companyName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    let company = await ProductionCompanyModel.findOne({ slug: companySlug })
    if (!company) {
      company = await new ProductionCompanyModel({
        name: pi.companyName.trim(),
        slug: companySlug,
        submittedBy: userId
      }).save()
    }
    companyId = company._id.toString()
  }

  // 4. Find or create Run
  const runQuery: any = { show: show._id }
  if (companyId) runQuery.productionCompany = companyId
  let run = await RunModel.findOne(runQuery)

  if (run) {
    if (venueIds.length > 0) {
      const existingVenues = run.venues.map((v: any) => v.toString())
      const newVenues = venueIds.filter(v => !existingVenues.includes(v))
      if (newVenues.length > 0) {
        run.venues.push(...newVenues as any)
        await run.save()
      }
    }
  } else {
    run = await new RunModel({
      show: show._id,
      ...(pi.runTitle?.trim() && { title: pi.runTitle.trim() }),
      ...(pi.runDescription?.trim() && { description: pi.runDescription.trim() }),
      productionCompany: companyId,
      venues: venueIds,
      ...(stageId && { stage: stageId }),
      ...(pi.startDate && { startDate: pi.startDate }),
      ...(pi.endDate && { endDate: pi.endDate }),
      submittedBy: userId,
      source: pi.dataSource
    }).save()
  }

  // 5. Create Performance (if date provided), dedup by run + date
  if (pi.date && venueIds.length > 0) {
    const dayStart = new Date(pi.date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(pi.date)
    dayEnd.setHours(23, 59, 59, 999)
    const existingPerf = await PerformanceModel.findOne({
      run: run._id,
      date: { $gte: dayStart, $lte: dayEnd }
    })

    if (!existingPerf) {
      await new PerformanceModel({
        run: run._id,
        date: pi.date,
        time: pi.time || '',
        venueId: venueIds[0],
        ticketUrl: pi.ticketUrl || '',
        ...(pi.performanceDescription?.trim() && {
          metadataOverrides: { description: pi.performanceDescription.trim() }
        }),
        submittedBy: userId,
        source: pi.dataSource
      }).save()
    }

    // Auto-extend run dates
    if (!run.startDate || pi.date < run.startDate) {
      run.startDate = pi.date
    }
    if (!run.endDate || pi.date > run.endDate) {
      run.endDate = pi.date
    }
    await run.save()
  }

  // 6. Create cast and crew (Person + Credit records) if provided
  async function createCredits(entries: any[], creditType: 'cast' | 'crew', defaultRole: string) {
    if (!entries?.length || !run) return
    for (let i = 0; i < entries.length; i++) {
      const { name, role, headshotUrl } = entries[i]
      if (!name?.trim()) continue

      const personSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      let person = await PersonModel.findOne({ slug: personSlug })
      if (!person) {
        person = await new PersonModel({
          name: name.trim(),
          slug: personSlug,
          ...(headshotUrl && { headshotUrl }),
          submittedBy: userId
        }).save()
      } else if (headshotUrl && !person.headshotUrl) {
        person.headshotUrl = headshotUrl
        await person.save()
      }

      const existingCredit = await CreditModel.findOne({ person: person._id, run: run._id })
      if (!existingCredit) {
        await new CreditModel({
          person: person._id,
          run: run._id,
          creditType,
          role: role?.trim() || defaultRole,
          order: i,
          submittedBy: userId
        }).save()
      }
    }
  }

  await createCredits(pi.cast, 'cast', 'Performer')
  await createCredits(pi.crew, 'crew', 'Crew')
}

export const approvePendingImport = mutationWithClientMutationId({
  name: 'approvePendingImport',
  description: 'Approve a pending import and promote it to real records',
  inputFields: {
    pendingImportId: { type: new GraphQLNonNull(GraphQLString) }
  },
  outputFields: {
    pendingImport: {
      type: pendingImportType,
      resolve: r => r.pendingImport
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ pendingImportId }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    const pi = await PendingImportModel.findById(pendingImportId)
    if (!pi) return { error: 'Pending import not found' }
    if (pi.status !== 'pending') return { error: `Already ${pi.status}` }

    try {
      await promoteToRecords(pi, ctx.user.id)
      pi.status = 'approved'
      pi.reviewedAt = new Date()
      pi.reviewedBy = ctx.user.id
      await pi.save()
      return { pendingImport: pi }
    } catch (err: any) {
      pi.error = err.message
      await pi.save()
      return { error: `Promotion failed: ${err.message}` }
    }
  }
})

export const rejectPendingImport = mutationWithClientMutationId({
  name: 'rejectPendingImport',
  description: 'Reject a pending import',
  inputFields: {
    pendingImportId: { type: new GraphQLNonNull(GraphQLString) }
  },
  outputFields: {
    pendingImport: {
      type: pendingImportType,
      resolve: r => r.pendingImport
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ pendingImportId }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    const pi = await PendingImportModel.findById(pendingImportId)
    if (!pi) return { error: 'Pending import not found' }
    if (pi.status !== 'pending') return { error: `Already ${pi.status}` }

    pi.status = 'rejected'
    pi.reviewedAt = new Date()
    pi.reviewedBy = ctx.user.id
    await pi.save()
    return { pendingImport: pi }
  }
})

export const editPendingImport = mutationWithClientMutationId({
  name: 'editPendingImport',
  description: 'Edit fields on a pending import before approving',
  inputFields: {
    pendingImportId: { type: new GraphQLNonNull(GraphQLString) },
    title: { type: GraphQLString },
    runTitle: { type: GraphQLString },
    showDescription: { type: GraphQLString },
    runDescription: { type: GraphQLString },
    performanceDescription: { type: GraphQLString },
    performanceTypes: { type: GraphQLString }, // comma-separated
    duration: { type: GraphQLString },
    date: { type: GraphQLString },
    time: { type: GraphQLString },
    venueName: { type: GraphQLString },
    stageName: { type: GraphQLString },
    companyName: { type: GraphQLString },
    ticketUrl: { type: GraphQLString }
  },
  outputFields: {
    pendingImport: {
      type: pendingImportType,
      resolve: r => r.pendingImport
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    const pi = await PendingImportModel.findById(input.pendingImportId)
    if (!pi) return { error: 'Pending import not found' }
    if (pi.status !== 'pending') return { error: `Cannot edit: already ${pi.status}` }

    // Update only provided fields
    if (input.title !== undefined) pi.title = input.title
    if (input.runTitle !== undefined) pi.runTitle = input.runTitle
    if (input.showDescription !== undefined) pi.showDescription = input.showDescription
    if (input.runDescription !== undefined) pi.runDescription = input.runDescription
    if (input.performanceDescription !== undefined) pi.performanceDescription = input.performanceDescription
    if (input.performanceTypes !== undefined) {
      pi.performanceTypes = input.performanceTypes.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean)
    }
    if (input.duration !== undefined) pi.duration = parseInt(input.duration, 10) || undefined
    if (input.date !== undefined) pi.date = input.date ? new Date(input.date) : undefined
    if (input.time !== undefined) pi.time = input.time
    if (input.venueName !== undefined) pi.venueName = input.venueName
    if (input.stageName !== undefined) pi.stageName = input.stageName
    if (input.companyName !== undefined) pi.companyName = input.companyName
    if (input.ticketUrl !== undefined) pi.ticketUrl = input.ticketUrl

    await pi.save()
    return { pendingImport: pi }
  }
})

export const autoValidatePendingImports = mutationWithClientMutationId({
  name: 'autoValidatePendingImports',
  description: 'Auto-approve pending imports older than 1 day',
  inputFields: {},
  outputFields: {
    approvedCount: {
      type: GraphQLInt,
      resolve: r => r.approvedCount
    },
    errorCount: {
      type: GraphQLInt,
      resolve: r => r.errorCount
    },
    ...errorField
  },
  mutateAndGetPayload: async (_input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const staleItems = await PendingImportModel.find({
      status: 'pending',
      importedAt: { $lt: oneDayAgo }
    })

    let approved = 0
    let errors = 0

    for (const pi of staleItems) {
      try {
        await promoteToRecords(pi, ctx.user.id)
        pi.status = 'approved'
        pi.reviewedAt = new Date()
        pi.reviewedBy = ctx.user.id
        await pi.save()
        approved++
      } catch (err: any) {
        pi.error = err.message
        await pi.save()
        errors++
      }
    }

    return { approvedCount: approved, errorCount: errors }
  }
})
