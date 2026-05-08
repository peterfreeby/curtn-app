import { chromium } from 'playwright'
import { politeNavigate, RobotsBlockedError, USER_AGENT } from '../services/scraping/politeNavigate'

// Generic class tokens to ignore when picking a "distinctive" selector for a child element.
// These are layout / framework / utility classes that don't tell us anything about the content.
const GENERIC_CLASS_TOKENS = [
  // Material UI
  'mui', 'css-',
  // Tailwind / utility CSS — common atomic prefixes
  'flex', 'block', 'inline', 'grid', 'hidden', 'visible',
  'text-', 'bg-', 'border-', 'rounded', 'shadow', 'opacity',
  'p-', 'px-', 'py-', 'pt-', 'pb-', 'pl-', 'pr-',
  'm-', 'mx-', 'my-', 'mt-', 'mb-', 'ml-', 'mr-',
  'w-', 'h-', 'min-', 'max-',
  'absolute', 'relative', 'fixed', 'sticky',
  'items-', 'justify-', 'gap-', 'space-',
  // Bootstrap
  'row', 'col', 'container', 'd-flex', 'd-block',
  // Generic state
  'active', 'disabled', 'focus', 'hover', 'selected', 'open', 'closed',
  // Nav-ish (we never want these for content)
  'nav', 'menu', 'submenu', 'dropdown', 'header', 'footer', 'sidebar'
]

// Field detection rules — applied to each child element with text or extractable attribute.
// Order matters: more-specific rules first.
function suggestField(input: {
  tag: string
  classes: string
  text: string
  hasHref: boolean
  hasSrc: boolean
  hrefSample?: string
}): string | null {
  const cls = input.classes.toLowerCase()
  const text = input.text.trim()

  // Class-name signals (highest priority — explicit semantic markup)
  if (/\b(show-title|event-title|title)\b/.test(cls) || /title/.test(cls)) return 'title'
  if (/\b(show-description|event-description|description|summary|synopsis|blurb)\b/.test(cls)) return 'showDescription'
  if (/\b(venue-name|venue|location)\b/.test(cls)) return 'venueName'
  if (/\b(start-date|event-date|date)\b/.test(cls) && !/datetime/.test(cls)) return 'date'
  if (/\b(start-time|event-time|time)\b/.test(cls)) return 'time'
  if (/\b(performer|cast)\b/.test(cls)) return 'personName'

  // Attribute signals
  if (input.hasSrc && (input.tag === 'IMG' || /image|photo|poster/.test(cls))) {
    return 'performanceImageUrl'
  }
  if (input.hasHref && input.tag === 'A') {
    if (input.hrefSample && /(ticket|book|buy|reserve|eventbrite|tixr)/i.test(input.hrefSample)) {
      return 'ticketUrl'
    }
    return 'ticketUrl' // Default for <a href> inside an event card — usually the click-to-book link
  }

  // Text-content patterns
  if (!text) return null

  // Time: "7:30 PM", "19:30"
  if (/^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(text)) return 'time'

  // Date: contains day or month name + a number
  if (/(mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text) && /\d/.test(text)) {
    return 'date'
  }

  // Long text → description
  if (text.length > 80) return 'showDescription'

  // Short, all-uppercase text → likely title (event card pattern)
  if (text.length >= 5 && text.length <= 120 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
    return 'title'
  }

  return null
}

interface ChildCandidate {
  selector: string          // best CSS selector relative to container
  tag: string
  textSample: string
  attribute?: string        // 'href' or 'src' if we should extract from attribute
  attributeSample?: string
  classes: string           // raw classes string for context
  suggestedField: string | null
}

interface ContainerCandidate {
  selector: string
  count: number
  sampleText: string
}

interface ProbeReport {
  url: string
  status: number | null
  title: string
  containers: ContainerCandidate[]
  inspectedContainer?: {
    selector: string
    childCandidates: ChildCandidate[]
  }
}

async function probeTemplate(
  url: string,
  containerSelector?: string,
  opts: { useCache: boolean } = { useCache: true }
): Promise<ProbeReport & { fromCache: boolean; cachedAt?: Date }> {
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT })
    const page = await context.newPage()
    const nav = await politeNavigate(page, url, { useCache: opts.useCache })
    const status = nav.status
    const title = await page.title()

    const containers = await page.evaluate((genericTokens) => {
      const indicators = ['event', 'show', 'performance', 'card', 'listing', 'item', 'tile', 'production']
      const navTokens = ['nav', 'menu', 'submenu', 'dropdown', 'header', 'footer', 'breadcrumb']
      const counts = new Map<string, { count: number; sample: string; el: Element }>()

      const all = document.querySelectorAll<HTMLElement>('*')
      for (const el of Array.from(all)) {
        const cls = el.className
        if (typeof cls !== 'string' || !cls) continue
        const lower = cls.toLowerCase()
        // Reject if any class contains nav/menu indicators
        if (navTokens.some(t => lower.includes(t))) continue
        if (!indicators.some(k => lower.includes(k))) continue
        const firstClass = cls.split(/\s+/).find(Boolean)
        if (!firstClass) continue
        const selector = `.${CSS.escape(firstClass)}`
        const existing = counts.get(selector)
        if (existing) {
          existing.count++
        } else {
          counts.set(selector, {
            count: 1,
            sample: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
            el
          })
        }
      }

      // Score each candidate by content quality, not just count.
      // Cards have meaty sample text (titles, dates, descriptions); structural grids do not.
      const scoreContainer = (sample: string): number => {
        let score = 0
        if (sample.length > 30) score += 2
        if (sample.length > 80) score += 2
        // Date/time markers strongly suggest event content
        if (/(mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(sample)) score += 3
        if (/\d{1,2}:\d{2}/.test(sample)) score += 2
        // Penalize structural-sounding samples
        if (/^(grid|calendar|menu|nav|list|page)/i.test(sample.replace(/\s+/g, ''))) score -= 5
        if (sample.length === 0) score -= 3
        return score
      }

      return Array.from(counts.entries())
        .filter(([, v]) => v.count >= 3 && v.count <= 200)
        .map(([selector, v]) => ({
          selector,
          count: v.count,
          sampleText: v.sample,
          contentScore: scoreContainer(v.sample)
        }))
        // Primary: content score (high to low). Secondary: count (high to low).
        .sort((a, b) => b.contentScore - a.contentScore || b.count - a.count)
        .slice(0, 8)
        .map(({ selector, count, sampleText }) => ({ selector, count, sampleText }))
    }, GENERIC_CLASS_TOKENS)

    const report: ProbeReport & { fromCache: boolean; cachedAt?: Date } = {
      url, status, title, containers,
      fromCache: nav.fromCache,
      cachedAt: nav.cachedAt
    }

    if (containerSelector) {
      const childCandidates = await page.evaluate(
        ({ containerSel, genericTokens }) => {
          const container = document.querySelector(containerSel)
          if (!container) return []

          // Build a frequency map of class usage WITHIN this container. The rarest
          // class on an element is the strongest signal that it identifies a specific
          // role (e.g., 'show-title' appears once; 'MuiTypography-root' appears 4×).
          const classFrequency = new Map<string, number>()
          {
            const allInContainer = container.querySelectorAll<HTMLElement>('*')
            for (const el of Array.from(allInContainer)) {
              const cls = (el.getAttribute('class') || '').trim()
              if (!cls) continue
              for (const token of cls.split(/\s+/).filter(Boolean)) {
                classFrequency.set(token, (classFrequency.get(token) || 0) + 1)
              }
            }
          }

          // Score a class: lower is better. Rarity dominates; generic tokens get a penalty.
          const scoreClass = (cls: string): number => {
            const lower = cls.toLowerCase()
            const freq = classFrequency.get(cls) || 99
            const generic = genericTokens.some((t: string) => lower.includes(t))
            const hashed = lower.length > 30
            // Rare classes win even when not pretty. Score = freq + small penalty for generic/hashed.
            return freq * 10 + (generic ? 5 : 0) + (hashed ? 3 : 0)
          }

          const pickSelector = (el: Element): string => {
            const cls = (el.getAttribute('class') || '').trim()
            if (!cls) return el.tagName.toLowerCase()
            const candidates = cls.split(/\s+/).filter(Boolean)
            if (candidates.length === 0) return el.tagName.toLowerCase()
            // Pick the rarest class that still appears > 0 times in the container.
            const best = candidates.slice().sort((a, b) => scoreClass(a) - scoreClass(b))[0]
            return `.${CSS.escape(best)}`
          }

          // Strategy: collect three kinds of content-bearing elements within the container:
          //   1. Leaf elements with text content (no element children)
          //   2. Any <a> with href
          //   3. Any <img> with src
          // For text-bearing leaves, walk UP the DOM and find the nearest ancestor (within
          // the container) with a distinctive class, since that's the most stable selector
          // — applyTemplateV2 calls .first() on the selector anyway.
          const candidates: any[] = []
          const seenSelectors = new Set<string>()

          const isDistinctive = (cls: string): boolean => scoreClass(cls) < 50

          const findStableAncestor = (el: Element): Element => {
            let cur: Element | null = el
            while (cur && cur !== container) {
              const cls = cur.getAttribute('class') || ''
              const tokens = cls.split(/\s+/).filter(Boolean)
              if (tokens.some(isDistinctive)) return cur
              cur = cur.parentElement
            }
            return el
          }

          const addCandidate = (
            anchorEl: Element,
            textSample: string,
            hasHref: boolean,
            hasSrc: boolean,
            hrefSample?: string,
            srcSample?: string
          ) => {
            const selector = pickSelector(anchorEl)
            if (seenSelectors.has(selector)) return
            seenSelectors.add(selector)
            candidates.push({
              selector,
              tag: anchorEl.tagName,
              textSample: textSample.slice(0, 100),
              hasHref,
              hasSrc,
              hrefSample: hrefSample?.slice(0, 200),
              srcSample: srcSample?.slice(0, 200),
              classes: (anchorEl.getAttribute('class') || '').trim()
            })
          }

          // 1. Text-bearing leaves
          const allElements = container.querySelectorAll<HTMLElement>('*')
          for (const el of Array.from(allElements)) {
            // Only leaf elements (no element children)
            if (el.children.length > 0) continue
            const text = (el.textContent || '').trim().replace(/\s+/g, ' ')
            if (!text) continue
            // Walk up to find a distinctive ancestor — that's where stable selectors live
            const anchor = findStableAncestor(el)
            addCandidate(anchor, text, false, false)
          }

          // 2. Anchors with href
          const anchors = container.querySelectorAll<HTMLAnchorElement>('a[href]')
          for (const a of Array.from(anchors)) {
            const href = a.getAttribute('href') || ''
            if (!href) continue
            const anchor = findStableAncestor(a)
            addCandidate(anchor, '', true, false, href, undefined)
          }

          // 3. Images with src or data-src
          const images = container.querySelectorAll<HTMLImageElement>('img')
          for (const img of Array.from(images)) {
            const src = img.getAttribute('src') || img.getAttribute('data-src') || ''
            if (!src) continue
            const anchor = findStableAncestor(img)
            addCandidate(anchor, '', false, true, undefined, src)
          }

          return candidates
        },
        { containerSel: containerSelector, genericTokens: GENERIC_CLASS_TOKENS }
      )

      const enriched: ChildCandidate[] = childCandidates.map(c => {
        const suggested = suggestField({
          tag: c.tag,
          classes: c.classes,
          text: c.textSample,
          hasHref: c.hasHref,
          hasSrc: c.hasSrc,
          hrefSample: c.hrefSample
        })
        const result: ChildCandidate = {
          selector: c.selector,
          tag: c.tag,
          textSample: c.textSample,
          classes: c.classes,
          suggestedField: suggested
        }
        if (c.hasHref) {
          result.attribute = 'href'
          result.attributeSample = c.hrefSample
        } else if (c.hasSrc) {
          result.attribute = 'src'
          result.attributeSample = c.srcSample
        }
        return result
      })

      report.inspectedContainer = {
        selector: containerSelector,
        childCandidates: enriched
      }
    }

    return report
  } finally {
    await browser.close()
  }
}

function buildTemplate(
  containerSelector: string,
  candidates: ChildCandidate[]
): any {
  // For each field, pick the best candidate. Most fields: take the first match.
  // ticketUrl: prefer external https URLs (real ticket links) over relative paths (in-app routes).
  const byField = new Map<string, ChildCandidate>()
  const scoreForField = (c: ChildCandidate, field: string): number => {
    if (field === 'ticketUrl' && c.attributeSample) {
      return /^https?:\/\//i.test(c.attributeSample) ? 10 : 0
    }
    return 0
  }
  for (const c of candidates) {
    if (!c.suggestedField) continue
    const existing = byField.get(c.suggestedField)
    if (!existing) {
      byField.set(c.suggestedField, c)
      continue
    }
    if (scoreForField(c, c.suggestedField) > scoreForField(existing, c.suggestedField)) {
      byField.set(c.suggestedField, c)
    }
  }

  const children: any[] = []
  let i = 0
  for (const [field, candidate] of byField.entries()) {
    const node: any = {
      type: 'field',
      id: `f${i++}`,
      csvField: field,
      selector: candidate.selector
    }
    if (candidate.attribute) {
      node.attribute = candidate.attribute
    }
    if (field === 'date') {
      node.transform = 'date'
    } else if (field === 'time') {
      node.transform = 'time'
    } else {
      node.transform = 'trim'
    }
    children.push(node)
  }

  return {
    version: 2,
    nodes: [
      {
        type: 'container',
        id: 'events',
        label: 'Events',
        selector: containerSelector,
        children
      }
    ]
  }
}

function parseArgs(argv: string[]) {
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else {
      positional.push(a)
    }
  }
  return { positional, flags }
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2))
  const url = positional[0]
  if (!url) {
    console.error('Usage: probeTemplate.ts <url> [--container <selector>] [--auto] [--no-cache]')
    console.error('       --container: inspect this selector and generate a template')
    console.error('       --auto:      pick the top-ranked container automatically')
    console.error('       --no-cache:  bypass disk cache and refetch')
    process.exit(1)
  }

  const containerArg = typeof flags.container === 'string' ? flags.container : undefined
  const auto = Boolean(flags.auto)
  const useCache = !flags['no-cache']
  const probeOpts = { useCache }

  const runProbe = async (sel?: string) => {
    try {
      return await probeTemplate(url, sel, probeOpts)
    } catch (err) {
      if (err instanceof RobotsBlockedError) {
        console.error()
        console.error(`robots.txt blocked the fetch: ${err.reason}`)
        console.error('This site explicitly opts out of automated access. Skip it or contact the venue first.')
        process.exit(2)
      }
      throw err
    }
  }

  if (!containerArg && !auto) {
    // Mode 1: list candidate containers
    const report = await runProbe()
    console.log()
    console.log(`URL: ${report.url}`)
    console.log(`HTTP: ${report.status}  Title: ${report.title}`)
    if (report.fromCache && report.cachedAt) {
      const ageMin = Math.floor((Date.now() - report.cachedAt.getTime()) / 60_000)
      console.log(`(cached ${ageMin}m ago — pass --no-cache to refetch)`)
    }
    console.log()
    if (report.containers.length === 0) {
      console.log('No candidate containers found.')
      console.log('This page may need a hand-coded scraper (Tier 3).')
      return
    }
    console.log('Candidate containers:')
    console.log()
    for (const c of report.containers) {
      console.log(`  ${c.selector}  (×${c.count})`)
      console.log(`    "${c.sampleText}"`)
      console.log()
    }
    console.log('Next: re-run with --container <selector> to generate a template, or --auto to pick the top one.')
    return
  }

  // Mode 2: inspect a chosen container and emit a template
  const firstReport = await runProbe()
  let chosen = containerArg
  if (auto) {
    if (firstReport.containers.length === 0) {
      console.error('No candidate containers found — cannot --auto. Try --container <selector> manually.')
      process.exit(1)
    }
    chosen = firstReport.containers[0].selector
    console.log(`[auto] Picked top container: ${chosen} (×${firstReport.containers[0].count})`)
  }

  const report = await runProbe(chosen!)
  if (!report.inspectedContainer || report.inspectedContainer.childCandidates.length === 0) {
    console.error(`No content found inside ${chosen}.`)
    process.exit(1)
  }

  console.log()
  console.log(`Container: ${report.inspectedContainer.selector}`)
  console.log(`Children with content: ${report.inspectedContainer.childCandidates.length}`)
  const isHashedSelector = (sel: string) =>
    /\.css-[a-z0-9]{5,}/i.test(sel) || /\.[a-z]+_[A-Za-z0-9]{5,}/i.test(sel)

  console.log()
  console.log('Field suggestions:')
  console.log()
  console.log('  Field                  Selector                                  Sample')
  console.log('  ─────                  ────────                                  ──────')
  let hasHashedSelectors = false
  for (const c of report.inspectedContainer.childCandidates) {
    const field = (c.suggestedField || '—').padEnd(22)
    const hashed = isHashedSelector(c.selector)
    if (hashed) hasHashedSelectors = true
    const selDisplay = hashed ? `${c.selector} ⚠` : c.selector
    const sel = selDisplay.slice(0, 40).padEnd(42)
    const sample = c.attribute
      ? `[${c.attribute}] ${(c.attributeSample || '').slice(0, 40)}`
      : c.textSample.slice(0, 50)
    console.log(`  ${field} ${sel} ${sample}`)
  }
  if (hasHashedSelectors) {
    console.log()
    console.log('⚠  Some selectors are CSS-in-JS hashes (e.g. .css-XXXXX). These regenerate on every')
    console.log('   site deploy and will break the template. Inspect the site and replace with stable')
    console.log('   classes, attribute selectors, or :nth-child positions before saving the template.')
  }
  console.log()
  console.log('Generated V2 template (paste into DataSource.config.strategy.template):')
  console.log()
  console.log(JSON.stringify(buildTemplate(chosen!, report.inspectedContainer.childCandidates), null, 2))
  console.log()
  console.log('Tip: review the suggestions, prune fields you don\'t want, then test with:')
  console.log(`  npx ts-node src/scripts/runScraper.ts <dataSourceId> --dry-run`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
