import { GraphQLString, GraphQLNonNull, GraphQLList, GraphQLInt } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { dataSourceType } from '../dataSourceTypes'
import { DataSourceModel } from '../dataSourceModel'
import { UserModel } from '../../user/userModel'
import { errorField } from '../../../graphql/errorField'
import {
  ScraperIssueModel,
  ACCEPTABLE_GAP_CATEGORIES,
} from '../../scraperIssue/scraperIssueModel'
import { PendingImportModel } from '../../pendingImport/pendingImportModel'

// Mark a set of "missing_*" fields as legitimately unavailable upstream for a
// source. Forward-looking: future re-stages won't be flagged for these fields
// (see flagScraperIssue) and the review table shows a muted "verified
// unavailable" marker instead of an empty cell that looks like a bug.
//
// Backfill on save: any OPEN issue on this source whose categories are now ALL
// accepted is closed as 'accepted' (distinct from 'resolved' = scraper fixed).
// If that leaves a flagged PendingImport with no remaining open issue, the row
// returns to the pending queue so it can be approved.
export const setSourceAcceptedGaps = mutationWithClientMutationId({
  name: 'setSourceAcceptedGaps',
  description: 'Set the fields verified as legitimately unavailable for a source (admin only)',
  inputFields: {
    dataSourceId: { type: new GraphQLNonNull(GraphQLString) },
    gaps: { type: new GraphQLList(GraphQLString) },
  },
  outputFields: {
    dataSource: { type: dataSourceType, resolve: r => r.dataSource },
    issuesAccepted: { type: GraphQLInt, resolve: r => r.issuesAccepted ?? 0 },
    rowsRestored: { type: GraphQLInt, resolve: r => r.rowsRestored ?? 0 },
    ...errorField,
  },
  mutateAndGetPayload: async ({ dataSourceId, gaps }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    const ds = await DataSourceModel.findById(dataSourceId)
    if (!ds) return { error: 'Data source not found' }

    const allowed = new Set<string>(ACCEPTABLE_GAP_CATEGORIES as readonly string[])
    const clean = (Array.isArray(gaps) ? gaps : [])
      .map((g: string) => String(g).trim())
      .filter((g: string) => allowed.has(g))
    const uniqueGaps = Array.from(new Set(clean))

    ds.acceptedGaps = uniqueGaps
    await ds.save()

    const acceptedSet = new Set(uniqueGaps)
    let issuesAccepted = 0
    let rowsRestored = 0

    if (acceptedSet.size > 0) {
      const openIssues = await ScraperIssueModel.find({
        dataSource: ds._id,
        status: 'open',
      })
      for (const issue of openIssues) {
        const cats = issue.categories ?? []
        // Leave note-only issues and any issue that still has a real defect.
        if (cats.length === 0) continue
        if (!cats.every((c: string) => acceptedSet.has(c))) continue

        issue.status = 'accepted'
        issue.resolvedAt = new Date()
        await issue.save()
        issuesAccepted++

        // Return the row to review only if nothing else keeps it flagged.
        if (issue.pendingImport) {
          const stillOpen = await ScraperIssueModel.countDocuments({
            pendingImport: issue.pendingImport,
            status: 'open',
          })
          if (stillOpen === 0) {
            const pi = await PendingImportModel.findById(issue.pendingImport)
            if (pi && pi.status === 'flagged') {
              pi.status = 'pending'
              await pi.save()
              rowsRestored++
            }
          }
        }
      }
    }

    return { dataSource: ds, issuesAccepted, rowsRestored }
  },
})
