export interface ParsedEvent {
  title: string
  description?: string
  date?: Date
  time?: string
  ticketUrl?: string
  imageUrl?: string
  // Extended fields
  runTitle?: string
  showDescription?: string
  runDescription?: string
  duration?: number
  startDate?: Date
  endDate?: Date
  cast?: { name: string; role?: string; headshotUrl?: string }[]
  crew?: { name: string; role?: string; headshotUrl?: string }[]
  rawData: Record<string, any>
}

export interface CleanupRules {
  stripPrefix?: string
  stripSuffix?: string
  defaultVenue?: string
  defaultStage?: string
  defaultCompany?: string
  defaultTypes?: string[]
  titleCase?: boolean
}

export function applyTitleCase(str: string): string {
  const minor = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'at', 'by', 'in', 'of', 'on', 'to', 'up'])
  return str.split(' ').map((word, i) => {
    if (i === 0 || !minor.has(word.toLowerCase())) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    }
    return word.toLowerCase()
  }).join(' ')
}

export function applyCleanupRules(title: string, rules: CleanupRules): string {
  let cleaned = title
  if (rules.stripPrefix && cleaned.startsWith(rules.stripPrefix)) {
    cleaned = cleaned.slice(rules.stripPrefix.length).trim()
  }
  if (rules.stripSuffix && cleaned.endsWith(rules.stripSuffix)) {
    cleaned = cleaned.slice(0, -rules.stripSuffix.length).trim()
  }
  if (rules.titleCase) {
    cleaned = applyTitleCase(cleaned)
  }
  return cleaned
}

export function extractTimeFromDate(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`
}

export const FETCH_TIMEOUT_MS = 15000
export const MAX_FEED_ITEMS = 200
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024 // 5MB
export const USER_AGENT = 'Curtn/1.0 (https://curtn.com; data-feed-reader)'
