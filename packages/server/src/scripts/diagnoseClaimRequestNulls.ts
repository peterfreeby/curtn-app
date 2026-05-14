/**
 * Find ClaimRequest documents that would null themselves in a GraphQL list
 * response. The dashboard's `myClaimRequests` field is `[ClaimRequest]`
 * (nullable items), so a NonNull violation on any sub-field at depth-1
 * nulls the entire item. Three known NonNull culprits at the top level:
 *
 *   - id           (via globalIdField — should always derive from _id)
 *   - status       ('pending' | 'approved' | 'rejected', schema-required)
 *   - requestedAt  (NonNull Date → ISO string)
 *
 * Plus the sub-resolvers under `target` (kind, targetId) and `person`
 * (id, name, slug) — those would null the SUB-field, not the parent, so
 * they aren't the primary suspects but the script reports them too.
 *
 * Usage:
 *   npx tsnd --clear --transpile-only src/scripts/diagnoseClaimRequestNulls.ts
 */

import { connectToDatabase, disconnectFromDatabase } from '../db/mongoose'
import { ClaimRequestModel } from '../entities/claimRequest/claimRequestModel'
import { PersonModel } from '../entities/person/personModel'
import { VenueModel } from '../entities/venue/venueModel'
import { ProductionCompanyModel } from '../entities/productionCompany/productionCompanyModel'

async function main() {
  await connectToDatabase()
  console.log('Connected to database\n')

  const all = await ClaimRequestModel.find().lean()
  console.log(`Inspecting ${all.length} ClaimRequest documents\n`)

  const problems: Array<{ id: string; issues: string[]; snapshot: any }> = []

  for (const cr of all) {
    const issues: string[] = []

    // 1. status (NonNull)
    if (!cr.status) issues.push('missing status')
    else if (!['pending', 'approved', 'rejected'].includes(cr.status)) {
      issues.push(`status value "${cr.status}" not in enum`)
    }

    // 2. requestedAt (NonNull, schema default Date.now)
    if (cr.requestedAt == null) issues.push('missing requestedAt')
    else if (!(cr.requestedAt instanceof Date)) {
      issues.push(`requestedAt is ${typeof cr.requestedAt} (${cr.requestedAt}) not Date`)
    } else if (Number.isNaN(cr.requestedAt.getTime())) {
      issues.push('requestedAt is Invalid Date')
    }

    // 3. user (referenced in the resolver, even if not in this query, an
    //    invalid user could break other queries — informational)
    if (!cr.user) issues.push('missing user ref')

    // 4. target sub-fields (would null target, not parent — but worth surfacing)
    if (cr.target) {
      if (!cr.target.kind) issues.push('target.kind missing')
      else if (!['venue', 'productionCompany', 'person'].includes(cr.target.kind)) {
        issues.push(`target.kind "${cr.target.kind}" not in enum`)
      }
      if (!cr.target.id) issues.push('target.id missing')
    }

    // 5. person field — if set but points at a Person that's been deleted
    //    OR a Person with missing required fields → person sub-field nulls
    if (cr.person && !cr.target) {
      const p = await PersonModel.findById(cr.person).select('name slug').lean()
      if (!p) issues.push(`person ref ${cr.person} → not found`)
      else {
        if (!p.name) issues.push('legacy person.name missing')
        if (!p.slug) issues.push('legacy person.slug missing')
      }
    }

    // 6. target.id points at deleted/malformed unit?
    if (cr.target?.kind && cr.target?.id) {
      const Model = cr.target.kind === 'venue' ? VenueModel
                  : cr.target.kind === 'productionCompany' ? ProductionCompanyModel
                  : cr.target.kind === 'person' ? PersonModel
                  : null
      if (Model) {
        const t = await (Model as any).findById(cr.target.id).select('name slug').lean()
        if (!t) issues.push(`target ${cr.target.kind}/${cr.target.id} → not found`)
        else if (!t.name) issues.push(`target ${cr.target.kind} has no name`)
        else if (!t.slug) issues.push(`target ${cr.target.kind} has no slug`)
      }
    }

    if (issues.length > 0) {
      problems.push({
        id: cr._id.toString(),
        issues,
        snapshot: {
          user: cr.user?.toString?.() ?? cr.user,
          status: cr.status,
          requestedAt: cr.requestedAt,
          person: cr.person?.toString?.() ?? cr.person ?? null,
          target: cr.target ?? null,
          createdAt: cr.createdAt,
        },
      })
    }
  }

  if (problems.length === 0) {
    console.log('No issues found. All rows would resolve cleanly.')
  } else {
    console.log(`Found ${problems.length} problem rows:\n`)
    for (const p of problems) {
      console.log(`ClaimRequest ${p.id}`)
      for (const issue of p.issues) console.log(`  - ${issue}`)
      console.log(`  snapshot: ${JSON.stringify(p.snapshot)}`)
      console.log('')
    }
  }

  await disconnectFromDatabase()
  console.log('Done.')
}

main().catch((err) => {
  console.error('diagnoseClaimRequestNulls failed:', err)
  process.exit(1)
})
