import '../config/env'
import { chromium, type Browser } from 'playwright'
import { promises as fs } from 'fs'
import path from 'path'
import { findJsonLdEvents } from '../services/scraping/extractors/jsonLd'
import { politeNavigate, RobotsBlockedError, USER_AGENT } from '../services/scraping/politeNavigate'

// Batch probe across the Venue Seed List markdown. For each venue with a
// website, captures:
//   - Tier classification (1/2/3) — reusing probeUrl.ts logic
//   - "Richness" signals — does this site expose dense Curtn-relevant data?
//     (detail page links, poster images, cast keywords, run-date patterns)
//   - Candidate programming-page URL (nav link matching /calendar, /events,
//     /season, /shows, /whats-on) — what the scraper actually wants
//
// Resumable: re-runs skip URLs already in the output TSV.
// Bounded concurrency: respects per-host gating in politeNavigate, but URLs
// are across many hosts so we can run several in parallel safely.

interface SeedVenue {
  city: string
  sectionHeading: string
  name: string
  website: string
  notes: string
}

interface ProbeRow {
  city: string
  sectionHeading: string
  name: string
  website: string
  finalUrl: string
  httpStatus: number | string
  title: string
  tier: 'tier-1-json-ld' | 'tier-2-template' | 'tier-3-code' | 'error' | 'robots-blocked'
  jsonLdCount: number
  jsonLdTypes: string
  containerSelector: string
  containerCount: number
  hasDetailLinks: boolean
  hasImages: boolean
  hasCastKeywords: boolean
  hasRunDatePattern: boolean
  programmingUrl: string
  reasoning: string
  error: string
}

const OUTPUT_HEADERS: (keyof ProbeRow)[] = [
  'city',
  'sectionHeading',
  'name',
  'website',
  'finalUrl',
  'httpStatus',
  'title',
  'tier',
  'jsonLdCount',
  'jsonLdTypes',
  'containerSelector',
  'containerCount',
  'hasDetailLinks',
  'hasImages',
  'hasCastKeywords',
  'hasRunDatePattern',
  'programmingUrl',
  'reasoning',
  'error'
]

// ---------- Markdown parsing ----------

function parseSeedMarkdown(md: string): SeedVenue[] {
  const lines = md.split('\n')
  const venues: SeedVenue[] = []

  let currentCity = ''
  let currentSection = ''
  let inTable = false
  let tableColumns: string[] = []

  // Cities we care about (skip "ITINERANT PRODUCING COMPANIES" header for
  // now — those have a different schema and aren't venues per se).
  const cityHeadings = new Set([
    'NEW YORK CITY',
    'LOS ANGELES',
    'MINNEAPOLIS – ST. PAUL'
  ])

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (line.startsWith('## ')) {
      const heading = line.slice(3).trim()
      if (cityHeadings.has(heading)) {
        currentCity = heading
        currentSection = ''
      } else {
        currentCity = ''  // Reset — we're out of a city section
      }
      inTable = false
      continue
    }

    if (line.startsWith('### ')) {
      currentSection = line.slice(4).trim()
      inTable = false
      continue
    }

    if (!currentCity) continue

    // Detect table header row (has |Name| or |Company|). Only check when NOT
    // already inside a table — otherwise venue names containing "Company"
    // (e.g. "Atlantic Theater Company") re-trigger header detection.
    if (!inTable && /^\|/.test(line) && /\b(Name|Company)\b/i.test(line)) {
      tableColumns = line.split('|').map(c => c.trim().toLowerCase()).filter(Boolean)
      inTable = true
      continue
    }

    // Skip the |---|---| separator
    if (inTable && /^\|[\s\-:|]+\|$/.test(line)) {
      continue
    }

    // Table data row
    if (inTable && line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim())
      if (cells.length === 0) continue

      const nameIdx = tableColumns.findIndex(c => c === 'name' || c === 'company')
      const websiteIdx = tableColumns.findIndex(c => c === 'website')
      const notesIdx = tableColumns.findIndex(c => c === 'notes')

      if (nameIdx === -1) continue
      const name = cells[nameIdx] || ''
      const website = websiteIdx >= 0 ? (cells[websiteIdx] || '') : ''
      const notes = notesIdx >= 0 ? (cells[notesIdx] || '') : ''

      if (!name) continue

      // Extract URL from website cell (it may be plain or markdown-linked)
      const urlMatch = website.match(/https?:\/\/[^\s)]+/)
      const cleanUrl = urlMatch ? urlMatch[0].replace(/[.,;]$/, '') : ''

      venues.push({
        city: currentCity,
        sectionHeading: currentSection,
        name,
        website: cleanUrl,
        notes
      })
    } else if (inTable) {
      // Blank line or non-table content ends the table
      inTable = false
    }
  }

  return venues
}

// ---------- Probe logic ----------

const PROGRAMMING_URL_HINTS = [
  '/calendar',
  '/events',
  '/season',
  '/shows',
  '/whats-on',
  '/whats_on',
  '/upcoming',
  '/performances',
  '/programming',
  '/on-stage',
  '/onstage',
  '/now-playing',
  '/now_playing',
  '/our-shows',
  '/this-season'
]

interface PageProbeResult {
  status: number | string
  finalUrl: string
  title: string
  jsonLdCount: number
  jsonLdTypes: string[]
  containerSelector: string
  containerCount: number
  hasDetailLinks: boolean
  hasImages: boolean
  hasCastKeywords: boolean
  hasRunDatePattern: boolean
  programmingUrl: string
}

async function probePage(browser: Browser, url: string, inputUrl: string): Promise<PageProbeResult | { error: string } | { robotsBlocked: string }> {
  const context = await browser.newContext({ userAgent: USER_AGENT })
  const page = await context.newPage()

  try {
    let nav
    try {
      nav = await politeNavigate(page, url, { useCache: true })
    } catch (err) {
      if (err instanceof RobotsBlockedError) return { robotsBlocked: err.reason }
      return { error: err instanceof Error ? err.message : String(err) }
    }

    // politeNavigate uses page.setContent() for cache hits, which leaves
    // page.url() as 'about:blank' — fall back to input URL in that case.
    const pageUrl = page.url()
    const finalUrl = pageUrl && pageUrl !== 'about:blank' ? pageUrl : inputUrl

    const title = (await page.title()).slice(0, 200)
    const jsonLd = await findJsonLdEvents(page)

    const containers = await page.evaluate(() => {
      const indicators = ['event', 'show', 'performance', 'card', 'listing', 'item']
      const counts = new Map<string, { count: number; sample: string }>()
      const all = document.querySelectorAll<HTMLElement>('*')
      for (const el of Array.from(all)) {
        const cls = el.className
        if (typeof cls !== 'string' || !cls) continue
        const lower = cls.toLowerCase()
        if (!indicators.some(k => lower.includes(k))) continue
        const firstClass = cls.split(/\s+/).find(Boolean)
        if (!firstClass) continue
        const selector = `.${CSS.escape(firstClass)}`
        const existing = counts.get(selector)
        if (existing) existing.count++
        else counts.set(selector, { count: 1, sample: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80) })
      }
      return Array.from(counts.entries())
        .filter(([, v]) => v.count >= 3 && v.count <= 100)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([selector, v]) => ({ selector, count: v.count, sample: v.sample }))
    })

    const bestSelector = containers.length > 0 ? containers[0].selector : ''
    const bestCount = containers.length > 0 ? containers[0].count : 0

    const richness = await page.evaluate((sel: string) => {
      const bodyText = document.body?.innerText || ''
      const lowerBody = bodyText.toLowerCase()

      let hasDetailLinks = false
      let hasImages = false
      if (sel) {
        try {
          const containers = document.querySelectorAll(sel)
          for (const c of Array.from(containers).slice(0, 10)) {
            if (c.querySelector('a[href]')) hasDetailLinks = true
            if (c.querySelector('img')) hasImages = true
            if (hasDetailLinks && hasImages) break
          }
        } catch { /* bad selector */ }
      }

      const castKeywords = /\b(starring|featuring|with cast|cast includes|written by|directed by|choreographed by)\b/i
      const hasCastKeywords = castKeywords.test(bodyText)

      const runDatePattern = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{1,2}\s*[-–—]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?[a-z]*\s*\d{1,2}|through\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|now\s*[-–—]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i
      const hasRunDatePattern = runDatePattern.test(lowerBody)

      return { hasDetailLinks, hasImages, hasCastKeywords, hasRunDatePattern }
    }, bestSelector)

    const programmingUrl = await page.evaluate((hints: string[]) => {
      const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[]
      const scored = links
        .map(a => {
          const href = a.href || ''
          const text = (a.textContent || '').trim().toLowerCase()
          if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) return null
          let score = 0
          for (const hint of hints) {
            if (href.toLowerCase().includes(hint)) score += 10
            if (text.includes(hint.replace(/[/_-]/g, ' ').trim())) score += 3
          }
          score -= Math.min(5, Math.floor(href.length / 80))
          return { href, score, text }
        })
        .filter((x): x is { href: string; score: number; text: string } => x !== null && x.score > 0)
        .sort((a, b) => b.score - a.score)
      return scored[0]?.href || ''
    }, PROGRAMMING_URL_HINTS)

    return {
      status: nav.status ?? 'null',
      finalUrl,
      title,
      jsonLdCount: jsonLd.count,
      jsonLdTypes: jsonLd.types,
      containerSelector: bestSelector,
      containerCount: bestCount,
      hasDetailLinks: richness.hasDetailLinks,
      hasImages: richness.hasImages,
      hasCastKeywords: richness.hasCastKeywords,
      hasRunDatePattern: richness.hasRunDatePattern,
      programmingUrl
    }
  } finally {
    await context.close()
  }
}

// Merge two probes — keep the better one for each signal. The programming-
// page probe usually has the real data; the homepage probe may have already
// found the programming URL we should keep.
function mergeProbes(homepage: PageProbeResult, programming: PageProbeResult): PageProbeResult {
  // Trust the programming page for richness + JSON-LD + container selector,
  // since that's the page the scraper will actually hit. Keep homepage's
  // programmingUrl (since the programming page's "programming URL" link
  // would likely point back at itself or somewhere weirder).
  return {
    status: programming.status,
    finalUrl: programming.finalUrl,
    title: programming.title || homepage.title,
    jsonLdCount: Math.max(programming.jsonLdCount, homepage.jsonLdCount),
    jsonLdTypes: programming.jsonLdCount >= homepage.jsonLdCount ? programming.jsonLdTypes : homepage.jsonLdTypes,
    containerSelector: programming.containerCount >= homepage.containerCount ? programming.containerSelector : homepage.containerSelector,
    containerCount: Math.max(programming.containerCount, homepage.containerCount),
    hasDetailLinks: programming.hasDetailLinks || homepage.hasDetailLinks,
    hasImages: programming.hasImages || homepage.hasImages,
    hasCastKeywords: programming.hasCastKeywords || homepage.hasCastKeywords,
    hasRunDatePattern: programming.hasRunDatePattern || homepage.hasRunDatePattern,
    programmingUrl: homepage.programmingUrl
  }
}

async function probeOne(browser: Browser, venue: SeedVenue): Promise<ProbeRow> {
  const base: ProbeRow = {
    city: venue.city,
    sectionHeading: venue.sectionHeading,
    name: venue.name,
    website: venue.website,
    finalUrl: '',
    httpStatus: '',
    title: '',
    tier: 'error',
    jsonLdCount: 0,
    jsonLdTypes: '',
    containerSelector: '',
    containerCount: 0,
    hasDetailLinks: false,
    hasImages: false,
    hasCastKeywords: false,
    hasRunDatePattern: false,
    programmingUrl: '',
    reasoning: '',
    error: ''
  }

  if (!venue.website) {
    base.error = 'no website'
    return base
  }

  const homepage = await probePage(browser, venue.website, venue.website)
  if ('robotsBlocked' in homepage) {
    base.tier = 'robots-blocked'
    base.reasoning = `robots.txt: ${homepage.robotsBlocked}`
    return base
  }
  if ('error' in homepage) {
    base.error = homepage.error
    return base
  }

  let final: PageProbeResult = homepage

  // If we found a programming URL distinct from the homepage, probe that
  // too — that's the page the scraper will actually target, so its richness
  // signals are more meaningful than the homepage's.
  if (homepage.programmingUrl && homepage.programmingUrl !== venue.website && homepage.programmingUrl !== homepage.finalUrl) {
    const programming = await probePage(browser, homepage.programmingUrl, homepage.programmingUrl)
    if (!('error' in programming) && !('robotsBlocked' in programming)) {
      final = mergeProbes(homepage, programming)
    }
  }

  base.finalUrl = final.finalUrl
  base.httpStatus = final.status
  base.title = final.title
  base.jsonLdCount = final.jsonLdCount
  base.jsonLdTypes = final.jsonLdTypes.join('|')
  base.containerSelector = final.containerSelector
  base.containerCount = final.containerCount
  base.hasDetailLinks = final.hasDetailLinks
  base.hasImages = final.hasImages
  base.hasCastKeywords = final.hasCastKeywords
  base.hasRunDatePattern = final.hasRunDatePattern
  base.programmingUrl = final.programmingUrl

  if (final.jsonLdCount > 0) {
    base.tier = 'tier-1-json-ld'
    base.reasoning = `${final.jsonLdCount} JSON-LD events (${final.jsonLdTypes.join(', ')})`
  } else if (final.containerCount >= 3) {
    base.tier = 'tier-2-template'
    base.reasoning = `${final.containerCount} repeating "${final.containerSelector}" elements`
  } else {
    base.tier = 'tier-3-code'
    base.reasoning = 'no JSON-LD, no obvious repeating list'
  }

  return base
}

// ---------- TSV I/O ----------

function tsvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return s.replace(/[\t\r\n]/g, ' ').slice(0, 500)
}

function rowToTsv(row: ProbeRow): string {
  return OUTPUT_HEADERS.map(k => tsvEscape(row[k])).join('\t')
}

async function readExistingOutput(outputPath: string): Promise<Set<string>> {
  try {
    const content = await fs.readFile(outputPath, 'utf8')
    const lines = content.split('\n').filter(Boolean)
    if (lines.length === 0) return new Set()
    const header = lines[0].split('\t')
    const websiteIdx = header.indexOf('website')
    if (websiteIdx === -1) return new Set()
    const done = new Set<string>()
    for (const line of lines.slice(1)) {
      const cells = line.split('\t')
      const url = cells[websiteIdx]
      if (url) done.add(url)
    }
    return done
  } catch {
    return new Set()
  }
}

// ---------- Bounded concurrency ----------

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T, i: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const i = next++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

// ---------- Main ----------

async function main() {
  const args = process.argv.slice(2)
  const seedPath = args.find(a => !a.startsWith('--')) || ''
  const outputArg = args.find(a => a.startsWith('--out='))
  const concurrencyArg = args.find(a => a.startsWith('--concurrency='))
  const limitArg = args.find(a => a.startsWith('--limit='))
  const filterArg = args.find(a => a.startsWith('--city='))

  if (!seedPath) {
    console.error('Usage: probeSeedList.ts <path-to-Performing-Arts-Venues.md> [options]')
    console.error('  --out=<path>           Output TSV path (default: /tmp/curtn_seed_probe.tsv)')
    console.error('  --concurrency=<n>      Parallel probes (default: 3)')
    console.error('  --limit=<n>            Stop after probing n venues (debug)')
    console.error('  --city=<name>          Only probe a single city (e.g. "NEW YORK CITY")')
    process.exit(1)
  }

  const outputPath = outputArg ? outputArg.slice('--out='.length) : '/tmp/curtn_seed_probe.tsv'
  const concurrency = concurrencyArg ? parseInt(concurrencyArg.slice('--concurrency='.length), 10) : 3
  const limit = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : Infinity
  const cityFilter = filterArg ? filterArg.slice('--city='.length) : null

  const md = await fs.readFile(path.resolve(seedPath), 'utf8')
  let venues = parseSeedMarkdown(md)

  if (cityFilter) {
    venues = venues.filter(v => v.city === cityFilter)
  }

  console.log(`Parsed ${venues.length} venues from ${seedPath}`)
  const withUrls = venues.filter(v => v.website)
  console.log(`${withUrls.length} have URLs; ${venues.length - withUrls.length} blank (will be skipped)`)

  const done = await readExistingOutput(outputPath)
  const todo = venues.filter(v => !v.website || !done.has(v.website))
  console.log(`${done.size} already probed (skipping). ${todo.length} remaining.`)

  const toProbe = todo.slice(0, limit)
  if (toProbe.length === 0) {
    console.log('Nothing to probe.')
    return
  }

  // Init output file with header if new
  let needsHeader = false
  try {
    await fs.access(outputPath)
  } catch {
    needsHeader = true
  }
  if (needsHeader) {
    await fs.writeFile(outputPath, OUTPUT_HEADERS.join('\t') + '\n')
  }

  const browser = await chromium.launch({ headless: true })
  let completed = 0
  const startedAt = Date.now()

  try {
    await runWithConcurrency(toProbe, async (v, i) => {
      const row = await probeOne(browser, v)
      await fs.appendFile(outputPath, rowToTsv(row) + '\n')
      completed++
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
      const tierBadge = row.tier === 'tier-1-json-ld' ? 'T1' : row.tier === 'tier-2-template' ? 'T2' : row.tier === 'tier-3-code' ? 'T3' : row.tier === 'robots-blocked' ? 'RB' : '!!'
      const richnessFlags = [
        row.hasDetailLinks ? 'D' : '-',
        row.hasImages ? 'I' : '-',
        row.hasCastKeywords ? 'C' : '-',
        row.hasRunDatePattern ? 'R' : '-'
      ].join('')
      console.log(
        `[${completed}/${toProbe.length}] ${tierBadge} ${richnessFlags} ${row.name.slice(0, 40).padEnd(40)} ${row.tier} | ${row.reasoning.slice(0, 60)} (${elapsed}s)`
      )
    }, concurrency)
  } finally {
    await browser.close()
  }

  console.log(`\nDone. Probed ${completed} venues in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`)
  console.log(`Output: ${outputPath}`)
  console.log('\nQuick summary by tier:')
  // Re-read output to show tier breakdown
  const content = await fs.readFile(outputPath, 'utf8')
  const dataLines = content.split('\n').slice(1).filter(Boolean)
  const tierCounts = new Map<string, number>()
  for (const line of dataLines) {
    const cells = line.split('\t')
    const tier = cells[OUTPUT_HEADERS.indexOf('tier')]
    tierCounts.set(tier, (tierCounts.get(tier) || 0) + 1)
  }
  for (const [tier, count] of Array.from(tierCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tier.padEnd(20)} ${count}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
