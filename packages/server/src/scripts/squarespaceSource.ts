import type { CsvRowInput } from '../services/importEngine'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Reusable scraper config for Squarespace venues.
//
// Squarespace's Events Collection renders a standardized markup across every
// site, so one template covers the whole cluster — only the startUrl and venue
// rowDefaults change per venue. Selectors (stable Squarespace class names):
//   .eventlist-event--upcoming   each upcoming event (the modifier drops past events)
//   .eventlist-title             title
//   .eventlist-meta-date         "Monday, May 25, 2026" (year-bearing)
//   .eventlist-meta-time         "8:30 PM 9:45 PM" → regex the first time
//   .eventlist-excerpt           blurb
//   .eventlist-column-thumbnail img[data-src]  poster (lazy-loaded via data-src)
//   .eventlist-title-link        → /events|/shows/<slug> detail page
//
// Usage: pass the events-collection page URL + venue defaults.
//   createXSource.ts → squarespaceConfig({ startUrl, rowDefaults })

export interface SquarespaceSourceOptions {
  startUrl: string
  rowDefaults: Partial<CsvRowInput>
  maxItems?: number
  // Some venues leave .eventlist-excerpt empty. Set true to detail-fetch the
  // full synopsis from each event page's og:description. Off by default —
  // skip it for high-volume venues whose excerpts are already populated.
  detailDescription?: boolean
  // Some venues' og:description is a poor auto-summary (e.g. a caption like
  // "ASL interpreter available") while the real synopsis sits in the event
  // body. Set this to the body wrapper selector (e.g. '.eventitem-column-content')
  // to pull the description from the DOM instead of og:description. Takes
  // precedence over detailDescription.
  detailDescriptionSelector?: string
}

export function squarespaceConfig(opts: SquarespaceSourceOptions): ScraperDataSourceConfig {
  const config: ScraperDataSourceConfig = {
    startUrl: opts.startUrl,
    strategy: {
      mode: 'template',
      template: {
        version: 2,
        nodes: [
          {
            type: 'container',
            id: 'events',
            label: 'Upcoming events',
            selector: '.eventlist-event--upcoming',
            children: [
              { type: 'field', id: 'title', csvField: 'title', selector: '.eventlist-title', transform: 'trim' },
              { type: 'field', id: 'date', csvField: 'date', selector: '.eventlist-meta-date', transform: 'date' },
              {
                type: 'field',
                id: 'time',
                csvField: 'time',
                selector: '.eventlist-meta-time',
                // "8:30 PM 9:45 PM" → first (start) time
                regex: '(\\d{1,2}:\\d{2}\\s*[AP]M)',
                transform: 'time'
              },
              { type: 'field', id: 'desc', csvField: 'showDescription', selector: '.eventlist-excerpt', transform: 'trim' },
              {
                type: 'field',
                id: 'poster',
                csvField: 'showImageUrl',
                selector: '.eventlist-column-thumbnail img',
                attribute: 'src', // extractField falls back to data-src/srcset (Squarespace lazy-loads)
                transform: 'trim'
              },
              {
                type: 'field',
                id: 'ticketUrl',
                csvField: 'ticketUrl',
                selector: '.eventlist-title-link',
                attribute: 'href',
                transform: 'trim'
              },
              {
                type: 'field',
                id: 'detailUrl',
                csvField: '_detailUrl',
                selector: '.eventlist-title-link',
                attribute: 'href',
                transform: 'trim'
              }
            ]
          }
        ]
      }
    },
    rowDefaults: opts.rowDefaults,
    maxItems: opts.maxItems ?? 40
  }

  // Optional: pull the full synopsis from each event page. Prefer a DOM body
  // selector when given (og:description can be a poor auto-summary); otherwise
  // fall back to og:description. Used when the listing excerpt is empty/partial.
  if (opts.detailDescriptionSelector) {
    config.detail = {
      fromField: '_detailUrl',
      fingerprint: ['title'],
      template: {
        version: 2,
        nodes: [
          {
            type: 'container',
            id: 'detail',
            label: 'Event detail',
            selector: 'body',
            children: [
              {
                type: 'field',
                id: 'desc',
                csvField: 'showDescription',
                selector: opts.detailDescriptionSelector,
                transform: 'trim'
              }
            ]
          }
        ]
      }
    }
    // The event body wrapper contains inline <style> blocks whose CSS text
    // (`#block-… { … }`, @media/@supports rules) leaks into the extracted
    // text. Cut everything from the first such marker so only the prose
    // synopsis survives.
    config.cleanup = {
      ...config.cleanup,
      descriptionStripPatterns: [
        ...(config.cleanup?.descriptionStripPatterns ?? []),
        '\\s*#block-[\\s\\S]*$',
        '\\s*@(media|supports)[\\s\\S]*$'
      ]
    }
  } else if (opts.detailDescription) {
    config.detail = {
      fromField: '_detailUrl',
      fingerprint: ['title'],
      template: {
        version: 2,
        nodes: [
          {
            type: 'container',
            id: 'detail',
            label: 'Event detail',
            selector: 'head',
            children: [
              {
                type: 'field',
                id: 'desc',
                csvField: 'showDescription',
                selector: 'meta[property="og:description"]',
                attribute: 'content',
                transform: 'trim'
              }
            ]
          }
        ]
      }
    }
  }

  return config
}
