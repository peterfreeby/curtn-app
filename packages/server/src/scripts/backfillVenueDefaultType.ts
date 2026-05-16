import '../config/env'
import mongoose from 'mongoose'
import { promises as fs } from 'fs'
import path from 'path'
import { VenueModel } from '../entities/venue/venueModel'
import { PERFORMANCE_TYPES } from '../entities/show/showModel'

// Backfill Venue.defaultPerformanceType from the Venue Seed List section
// headings. The seed list already groups venues by discipline (### Comedy /
// Improv, ### Dance, ### Opera, ### Burlesque / Cabaret, theater tiers), so
// one mapping pass populates the existing Venue records. See
// [[Venue Default Performance Type]].
//
// Safe by default:
//   - Only sets venues whose defaultPerformanceType is currently unset
//     (won't clobber a manual admin/claimant choice). --force overrides.
//   - A venue that appears under conflicting disciplines across sections is
//     treated as mixed-discipline and left unset (per the design decision).
//   - --dry-run previews without writing.
//
// Usage: npx ts-node src/scripts/backfillVenueDefaultType.ts <seed.md> [--dry-run] [--force]

// Map an H3 section heading to a PERFORMANCE_TYPES value. Order matters —
// check the specific disciplines before falling back to theater.
function sectionToType(heading: string): string | null {
  const h = heading.toLowerCase()
  if (/\bcomedy\b|\bimprov\b/.test(h)) return 'comedy'
  if (/\bdance\b/.test(h)) return 'dance'
  if (/\bopera\b/.test(h)) return 'opera'
  if (/\bburlesque\b|\bcabaret\b/.test(h)) return 'cabaret'
  // Broadway / Off-Broadway / Off-Off / regional / indie / black box /
  // outer boroughs / OC — all theater.
  if (/broadway|regional|indie|black box|institutional|nonprofit|long-run|outer borough|orange county|99-seat|established|experimental|mid-size/.test(h)) {
    return 'theater'
  }
  return null
}

function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

interface ParsedVenue { name: string; section: string }

function parseSeed(md: string): ParsedVenue[] {
  const lines = md.split('\n')
  const out: ParsedVenue[] = []
  let city = ''
  let section = ''
  let inTable = false
  let cols: string[] = []
  const cities = new Set(['NEW YORK CITY', 'LOS ANGELES', 'MINNEAPOLIS – ST. PAUL'])

  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('## ')) {
      const h = line.slice(3).trim()
      city = cities.has(h) ? h : ''
      section = ''
      inTable = false
      continue
    }
    if (line.startsWith('### ')) {
      section = line.slice(4).trim()
      inTable = false
      continue
    }
    if (!city) continue
    // Only detect a header row when NOT already in a table — venue names
    // containing "Company" would otherwise re-trigger detection.
    if (!inTable && /^\|/.test(line) && /\b(Name|Company)\b/i.test(line)) {
      cols = line.split('|').map(c => c.trim().toLowerCase()).filter(Boolean)
      inTable = true
      continue
    }
    if (inTable && /^\|[\s\-:|]+\|$/.test(line)) continue
    if (inTable && line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim())
      const nameIdx = cols.findIndex(c => c === 'name' || c === 'company')
      if (nameIdx === -1) continue
      const name = cells[nameIdx] || ''
      if (name) out.push({ name, section })
    } else if (inTable) {
      inTable = false
    }
  }
  return out
}

async function main() {
  const args = process.argv.slice(2)
  const seedPath = args.find(a => !a.startsWith('--'))
  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force')

  if (!seedPath) {
    console.error('Usage: backfillVenueDefaultType.ts <path-to-Performing-Arts-Venues.md> [--dry-run] [--force]')
    process.exit(1)
  }

  const md = await fs.readFile(path.resolve(seedPath), 'utf8')
  const parsed = parseSeed(md)

  // Resolve each venue's type from its section(s). Conflicting types across
  // sections → mixed-discipline → leave unset.
  const bySlug = new Map<string, { name: string; types: Set<string> }>()
  for (const v of parsed) {
    const type = sectionToType(v.section)
    if (!type) continue
    const slug = toSlug(v.name)
    if (!slug) continue
    if (!bySlug.has(slug)) bySlug.set(slug, { name: v.name, types: new Set() })
    bySlug.get(slug)!.types.add(type)
  }

  const valid = new Set<string>(PERFORMANCE_TYPES as readonly string[])
  let resolved = 0
  let mixed = 0
  const plan: { slug: string; name: string; type: string }[] = []
  for (const [slug, info] of bySlug) {
    if (info.types.size === 1) {
      const type = [...info.types][0]
      if (valid.has(type)) {
        plan.push({ slug, name: info.name, type })
        resolved++
      }
    } else {
      mixed++ // multiple disciplines — mixed venue, leave unset
    }
  }

  console.log(`Parsed ${parsed.length} venue rows → ${bySlug.size} unique venues`)
  console.log(`Single-discipline (will set): ${resolved} | mixed-discipline (left unset): ${mixed}`)

  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    let set = 0
    let skippedNoVenue = 0
    let skippedHasValue = 0
    for (const p of plan) {
      const venue = await VenueModel.findOne({ slug: p.slug })
      if (!venue) {
        skippedNoVenue++
        continue
      }
      if (venue.defaultPerformanceType && !force) {
        skippedHasValue++
        continue
      }
      if (venue.defaultPerformanceType === p.type) {
        continue
      }
      if (dryRun) {
        console.log(`  [dry] ${p.name} (${p.slug}) → ${p.type}${venue.defaultPerformanceType ? ` (was ${venue.defaultPerformanceType})` : ''}`)
        set++
      } else {
        venue.defaultPerformanceType = p.type as any
        await venue.save()
        set++
      }
    }

    console.log('')
    console.log(`${dryRun ? '[dry-run] would set' : 'Set'}: ${set}`)
    console.log(`Skipped — no matching Venue record yet: ${skippedNoVenue}`)
    console.log(`Skipped — already has a value (use --force to override): ${skippedHasValue}`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
