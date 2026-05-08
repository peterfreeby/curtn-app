import { chromium } from 'playwright'
import { findJsonLdEvents } from '../services/scraping/extractors/jsonLd'
import { politeNavigate, RobotsBlockedError, USER_AGENT } from '../services/scraping/politeNavigate'

interface ProbeReport {
  url: string
  status: number | null
  title: string
  fromCache: boolean
  cachedAt?: Date
  jsonLd: { count: number; types: string[] }
  candidateLists: { selector: string; count: number; sampleText: string }[]
  recommendation: 'tier-1-json-ld' | 'tier-2-template' | 'tier-3-code'
  reasoning: string
}

async function probe(url: string, opts: { useCache: boolean }): Promise<ProbeReport> {
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT })
    const page = await context.newPage()
    const nav = await politeNavigate(page, url, { useCache: opts.useCache })
    const status = nav.status
    const title = await page.title()

    const jsonLd = await findJsonLdEvents(page)

    // Heuristic: find repeating containers that likely hold events.
    // Look for the most common parent of multiple children matching event-ish selectors.
    const candidateLists = await page.evaluate(() => {
      const indicators = ['event', 'show', 'performance', 'card', 'listing', 'item']
      const counts = new Map<string, { count: number; sample: string }>()

      const all = document.querySelectorAll<HTMLElement>('*')
      for (const el of Array.from(all)) {
        const cls = el.className
        if (typeof cls !== 'string' || !cls) continue
        const lower = cls.toLowerCase()
        if (!indicators.some(k => lower.includes(k))) continue
        // Use the first class as a rough selector key
        const firstClass = cls.split(/\s+/).find(Boolean)
        if (!firstClass) continue
        const selector = `.${CSS.escape(firstClass)}`
        const existing = counts.get(selector)
        if (existing) {
          existing.count++
        } else {
          counts.set(selector, {
            count: 1,
            sample: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80)
          })
        }
      }

      return Array.from(counts.entries())
        .filter(([, v]) => v.count >= 3 && v.count <= 100)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 8)
        .map(([selector, v]) => ({ selector, count: v.count, sampleText: v.sample }))
    })

    let recommendation: ProbeReport['recommendation']
    let reasoning: string
    if (jsonLd.count > 0) {
      recommendation = 'tier-1-json-ld'
      reasoning = `Found ${jsonLd.count} JSON-LD event node(s) (${jsonLd.types.join(', ')}). Tier 1 should work with no per-site config beyond a DataSource record.`
    } else if (candidateLists.length > 0 && candidateLists[0].count >= 3) {
      recommendation = 'tier-2-template'
      reasoning = `No JSON-LD found, but ${candidateLists[0].count} elements match "${candidateLists[0].selector}" — looks like a list page. Author a parsing template.`
    } else {
      recommendation = 'tier-3-code'
      reasoning = 'No JSON-LD and no obvious repeating structure. May need a hand-coded scraper.'
    }

    return {
      url,
      status,
      title,
      fromCache: nav.fromCache,
      cachedAt: nav.cachedAt,
      jsonLd,
      candidateLists,
      recommendation,
      reasoning
    }
  } finally {
    await browser.close()
  }
}

async function main() {
  const args = process.argv.slice(2)
  const useCache = args.includes('--cache')
  const url = args.find(a => !a.startsWith('--'))
  if (!url) {
    console.error('Usage: probeUrl.ts <url> [--cache]')
    console.error('       --cache: read+write disk cache (default: off, since')
    console.error('                rendered HTML cached from SPAs misbehaves')
    console.error('                when fed back to Playwright via setContent)')
    process.exit(1)
  }

  let report: ProbeReport
  try {
    report = await probe(url, { useCache })
  } catch (err) {
    if (err instanceof RobotsBlockedError) {
      console.error()
      console.error(`robots.txt blocked the fetch: ${err.reason}`)
      console.error('This site explicitly opts out of automated access. Skip it or contact the venue first.')
      process.exit(2)
    }
    throw err
  }

  console.log()
  console.log(`URL: ${report.url}`)
  console.log(`HTTP: ${report.status}`)
  console.log(`Title: ${report.title}`)
  if (report.fromCache && report.cachedAt) {
    const ageMin = Math.floor((Date.now() - report.cachedAt.getTime()) / 60_000)
    console.log(`(served from cache, ${ageMin}m old — pass --no-cache to refetch)`)
  }
  console.log()
  console.log(`JSON-LD events: ${report.jsonLd.count}${report.jsonLd.types.length ? ` [${report.jsonLd.types.join(', ')}]` : ''}`)
  console.log()
  if (report.candidateLists.length > 0) {
    console.log('Candidate list selectors:')
    for (const c of report.candidateLists) {
      console.log(`  ${c.selector}  (×${c.count})  "${c.sampleText}"`)
    }
    console.log()
  }
  console.log(`Recommendation: ${report.recommendation}`)
  console.log(`  ${report.reasoning}`)
  console.log()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
