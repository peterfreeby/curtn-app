import { GraphQLString, GraphQLNonNull, GraphQLList, GraphQLBoolean } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { UserModel } from '../../user/userModel'
import { PendingImportModel } from '../pendingImportModel'
import { pendingImportType } from '../pendingImportTypes'
import { ScraperIssueModel, SCRAPER_ISSUE_CATEGORIES } from '../../scraperIssue/scraperIssueModel'

// Flag a scraper-quality problem on a reviewed import WITHOUT rejecting it.
// Logs to the ScraperIssue collection so we can later see which sources need
// a fix. The PendingImport itself is left untouched (stays in the queue).
export const flagScraperIssue = mutationWithClientMutationId({
  name: 'flagScraperIssue',
  description: 'Log a scraper-quality issue on a pending import (does not reject it)',
  inputFields: {
    pendingImportId: { type: new GraphQLNonNull(GraphQLString) },
    categories: { type: new GraphQLList(GraphQLString) },
    note: { type: GraphQLString },
  },
  outputFields: {
    pendingImport: { type: pendingImportType, resolve: r => r.pendingImport },
    flagged: { type: GraphQLBoolean, resolve: r => r.flagged },
    issueId: { type: GraphQLString, resolve: r => r.issueId ?? null },
    ...errorField,
  },
  mutateAndGetPayload: async ({ pendingImportId, categories, note }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    const pi = await PendingImportModel.findById(pendingImportId)
    if (!pi) return { error: 'Pending import not found' }

    const allowed = new Set<string>(SCRAPER_ISSUE_CATEGORIES as readonly string[])
    const cats = (Array.isArray(categories) ? categories : [])
      .map((c: string) => String(c).trim())
      .filter((c: string) => allowed.has(c))
    const cleanNote = typeof note === 'string' ? note.trim() : ''
    if (cats.length === 0 && !cleanNote) {
      return { error: 'Pick at least one category or add a note' }
    }

    const issue = await ScraperIssueModel.create({
      dataSource: pi.dataSource,
      pendingImport: pi._id,
      title: pi.title,
      venueName: pi.venueName,
      categories: cats,
      note: cleanNote || undefined,
      status: 'open',
      createdBy: ctx.user.id,
    })

    // Pull it out of the active review queue (logged, not rejected). Only flip a
    // still-pending row so flagging never un-approves/un-rejects anything.
    if (pi.status === 'pending') {
      pi.status = 'flagged'
      pi.reviewedAt = new Date()
      pi.reviewedBy = ctx.user.id
      await pi.save()
    }

    return { pendingImport: pi, flagged: true, issueId: issue._id.toString() }
  },
})
