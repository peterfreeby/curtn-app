import axios from 'axios'

// Eventbrite API configuration
const EVENTBRITE_API_BASE = 'https://www.eventbriteapi.com/v3'

// Get API token from environment variables
const getEventbriteToken = () => {
  const token = process.env.EVENTBRITE_API_TOKEN
  if (!token) {
    throw new Error('EVENTBRITE_API_TOKEN environment variable is required')
  }
  return token
}

// Types for Eventbrite responses
export interface EventbriteEvent {
  id: string
  name: {
    text: string
    html?: string
  }
  description: {
    text?: string
    html?: string
  }
  start: {
    timezone: string
    local: string
    utc: string
  }
  end: {
    timezone: string
    local: string
    utc: string
  }
  url: string
  vanity_url?: string
  created: string
  changed: string
  published: string
  status: string
  currency: string
  online_event: boolean
  organization_id: string
  organizer_id: string
  organizer: {
    name: string
    description?: {
      text?: string
    }
  }
  logo?: {
    url: string
  }
  venue_id?: string
  venue?: EventbriteVenue
  category_id: string
  subcategory_id?: string
  format_id: string
  resource_uri: string
  is_series?: boolean
  is_series_parent?: boolean
  inventory_type: string
  show_remaining?: boolean
  ticket_availability?: {
    has_available_tickets: boolean
    minimum_ticket_price?: {
      currency: string
      value: number
      major_value: string
    }
    maximum_ticket_price?: {
      currency: string
      value: number
      major_value: string
    }
  }
}

export interface EventbriteVenue {
  id: string
  name: string
  address: {
    address_1?: string
    address_2?: string
    city?: string
    region?: string
    postal_code?: string
    country?: string
    localized_address_display?: string
    localized_area_display?: string
    localized_multi_line_address_display?: string[]
  }
  latitude?: string
  longitude?: string
  resource_uri: string
}

export interface EventbriteCategory {
  id: string
  resource_uri: string
  name: string
  name_localized: string
  short_name: string
  short_name_localized: string
}

// Helper function to make authenticated requests
async function makeEventbriteRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
  try {
    const token = getEventbriteToken()
    
    const response = await axios.get(`${EVENTBRITE_API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params,
      timeout: 30000
    })

    return response.data
  } catch (error: any) {
    console.error('Eventbrite API request failed:', error?.response?.data || error.message)
    throw new Error(`Eventbrite API error: ${error?.response?.status} ${error?.response?.statusText || error.message}`)
  }
}

// Search for events by location and categories
export async function searchEventsByLocation(
  location: string,
  categories: string[] = [],
  options: {
    startDate?: string
    endDate?: string
    sortBy?: 'date' | 'distance' | 'best'
    priceType?: 'free' | 'paid'
    limit?: number
  } = {}
): Promise<EventbriteEvent[]> {
  
  const {
    startDate,
    endDate,
    sortBy = 'date',
    priceType,
    limit = 50
  } = options

  const params: Record<string, any> = {
    'location.address': location,
    'location.within': '25mi', // Search within 25 miles
    'sort_by': sortBy,
    'expand': 'venue,organizer,ticket_availability',
    'page_size': Math.min(limit, 200), // Eventbrite max is 200
    'include_all_series_instances': true
  }

  // Add date filters
  if (startDate) {
    params['start_date.range_start'] = startDate
  }
  if (endDate) {
    params['start_date.range_end'] = endDate
  }

  // Add category filters
  if (categories.length > 0) {
    params['categories'] = categories.join(',')
  }

  // Add price filter
  if (priceType === 'free') {
    params['price'] = 'free'
  } else if (priceType === 'paid') {
    params['price'] = 'paid'
  }

  const data = await makeEventbriteRequest('/events/search/', params)
  return data.events || []
}

// Get performance-related events (theater, music, etc.)
export async function searchPerformanceEvents(
  city: string,
  options: {
    startDate?: string
    endDate?: string
    limit?: number
  } = {}
): Promise<EventbriteEvent[]> {
  
  // Performance-related category IDs in Eventbrite
  const performanceCategories = [
    '105', // Performing & Visual Arts
    '103', // Music  
    '109', // Film, Media & Entertainment
    '113', // Community & Culture
  ]

  // Map cities to search locations
  const cityLocations: { [key: string]: string } = {
    'NYC': 'New York, NY',
    'New York': 'New York, NY',
    'Manhattan': 'Manhattan, NY',
    'Minneapolis': 'Minneapolis, MN',
    'LA': 'Los Angeles, CA',
    'Los Angeles': 'Los Angeles, CA'
  }

  const location = cityLocations[city] || city

  return await searchEventsByLocation(location, performanceCategories, {
    ...options,
    sortBy: 'date'
  })
}

// Get events at a specific venue
export async function getEventsByVenue(venueId: string, limit = 20): Promise<EventbriteEvent[]> {
  const params = {
    'venue.id': venueId,
    'expand': 'venue,organizer,ticket_availability',
    'page_size': Math.min(limit, 200),
    'sort_by': 'date'
  }

  const data = await makeEventbriteRequest('/events/search/', params)
  return data.events || []
}

// Get detailed information about a specific event
export async function getEventDetails(eventId: string): Promise<EventbriteEvent | null> {
  try {
    const data = await makeEventbriteRequest(`/events/${eventId}/`, {
      expand: 'venue,organizer,ticket_availability,category,subcategory,format'
    })
    return data
  } catch (error) {
    console.error(`Failed to get event details for ${eventId}:`, error)
    return null
  }
}

// Get venue information
export async function getVenueDetails(venueId: string): Promise<EventbriteVenue | null> {
  try {
    const data = await makeEventbriteRequest(`/venues/${venueId}/`)
    return data
  } catch (error) {
    console.error(`Failed to get venue details for ${venueId}:`, error)
    return null
  }
}

// Get available categories
export async function getCategories(): Promise<EventbriteCategory[]> {
  try {
    const data = await makeEventbriteRequest('/categories/')
    return data.categories || []
  } catch (error) {
    console.error('Failed to get categories:', error)
    return []
  }
}

// Search for theater-specific events with better filtering
export async function searchTheaterEvents(
  city: string,
  options: {
    query?: string
    startDate?: string
    endDate?: string
    limit?: number
  } = {}
): Promise<EventbriteEvent[]> {
  
  const { query, ...searchOptions } = options
  
  // Get performance events first
  const events = await searchPerformanceEvents(city, searchOptions)
  
  // Filter for theater-related events by keywords
  const theaterKeywords = [
    'theater', 'theatre', 'play', 'musical', 'drama', 'comedy', 'performance',
    'opera', 'ballet', 'dance', 'cabaret', 'improv', 'standup', 'stand-up',
    'spoken word', 'storytelling', 'monologue', 'one-man', 'one-woman'
  ]

  let filteredEvents = events.filter(event => {
    const title = event.name.text.toLowerCase()
    const description = event.description?.text?.toLowerCase() || ''
    const combined = `${title} ${description}`
    
    return theaterKeywords.some(keyword => combined.includes(keyword))
  })

  // Additional filtering by query if provided
  if (query) {
    const queryLower = query.toLowerCase()
    filteredEvents = filteredEvents.filter(event => {
      const title = event.name.text.toLowerCase()
      const description = event.description?.text?.toLowerCase() || ''
      return title.includes(queryLower) || description.includes(queryLower)
    })
  }

  return filteredEvents
}

// Export the main API object
export const EventbriteAPI = {
  searchEventsByLocation,
  searchPerformanceEvents,
  searchTheaterEvents,
  getEventsByVenue,
  getEventDetails,
  getVenueDetails,
  getCategories
}