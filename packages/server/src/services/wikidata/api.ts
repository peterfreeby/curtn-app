import axios from 'axios'

// Endpoints
const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
const WIKIPEDIA_REST_BASE = 'https://en.wikipedia.org/api/rest_v1'
const WIKIPEDIA_ACTION_BASE = 'https://en.wikipedia.org/w/api.php'

const USER_AGENT = 'CurtnBot/1.0 (https://curtn.com; hello@curtn.com)'

// --- Types ---

export interface WikidataPerformance {
  item: string          // Wikidata URL (e.g. http://www.wikidata.org/entity/Q19320959)
  itemLabel: string
  performanceType?: string
  performanceTypeLabel?: string
  venue?: string
  venueLabel?: string
  location?: string
  locationLabel?: string
  premiereDate?: string
  director?: string
  directorLabel?: string
  company?: string
  companyLabel?: string
  description?: string
  coordinates?: string
  duration?: string     // minutes
  composer?: string
  composerLabel?: string
  lyricist?: string
  lyricistLabel?: string
  choreographer?: string
  choreographerLabel?: string
}

export interface WikidataVenue {
  venue: string         // Wikidata URL
  venueLabel: string
  address?: string
  coordinates?: string  // "Point(lng lat)" format
  city?: string
  cityLabel?: string
  capacity?: string
  venueType?: string
  website?: string
  architect?: string
  architectLabel?: string
  openedDate?: string
  owner?: string
  ownerLabel?: string
}

export interface WikipediaSummary {
  title: string
  extract: string       // Plaintext intro paragraph
  description?: string  // Short Wikidata description
  thumbnail?: {
    source: string
    width: number
    height: number
  }
  wikidataId?: string   // e.g. "Q19320959"
  pageUrl: string
}

export interface CategoryMember {
  title: string
  pageid: number
  ns: number            // 0 = article, 14 = category
}

// --- Helpers ---

function extractWikidataId(url: string): string {
  return url.replace('http://www.wikidata.org/entity/', '')
}

function parseCoordinates(point?: string): { lat: number; lng: number } | null {
  if (!point) return null
  // Format: "Point(-73.986 40.759)" — note: lng first, then lat
  const match = point.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/)
  if (!match) return null
  return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) }
}

// Rate-limit helper: wait between requests to be polite
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// --- SPARQL Layer (Wikidata) ---

async function executeSparqlQuery(query: string): Promise<any> {
  try {
    const response = await axios.get(WIKIDATA_SPARQL_ENDPOINT, {
      params: { query, format: 'json' },
      headers: { 'User-Agent': USER_AGENT },
      timeout: 30000
    })
    return response.data.results.bindings
  } catch (error) {
    console.error('Wikidata SPARQL query failed:', error)
    throw new Error(`Wikidata query failed: ${error}`)
  }
}

// Search for theatrical performances
export async function searchTheatricalPerformances(searchTerm: string, limit = 20): Promise<WikidataPerformance[]> {
  const query = `
    SELECT DISTINCT ?item ?itemLabel ?performanceType ?performanceTypeLabel ?venue ?venueLabel
                    ?location ?locationLabel ?premiereDate ?director ?directorLabel
                    ?company ?companyLabel ?description ?duration
                    ?composer ?composerLabel ?lyricist ?lyricistLabel
                    ?choreographer ?choreographerLabel WHERE {

      {
        ?item wdt:P31 wd:Q2743 .          # musical
      } UNION {
        ?item wdt:P31 wd:Q25379 .         # theatrical work
      } UNION {
        ?item wdt:P31 wd:Q1344 .          # opera
      } UNION {
        ?item wdt:P31 wd:Q16623671 .      # musical theatre production
      }

      ?item rdfs:label ?itemLabel .
      FILTER(CONTAINS(LCASE(?itemLabel), "${searchTerm.toLowerCase()}"))
      FILTER(LANG(?itemLabel) = "en")

      FILTER NOT EXISTS { ?item wdt:P31 wd:Q21191270 }
      FILTER NOT EXISTS { ?item wdt:P31 wd:Q1261214 }
      FILTER NOT EXISTS { ?item wdt:P179 ?series }

      OPTIONAL {
        ?item wdt:P136 ?performanceType .
        ?performanceType rdfs:label ?performanceTypeLabel .
        FILTER(LANG(?performanceTypeLabel) = "en")
      }
      OPTIONAL {
        ?item wdt:P4647 ?venue .
        ?venue rdfs:label ?venueLabel .
        FILTER(LANG(?venueLabel) = "en")
      }
      OPTIONAL { ?item wdt:P1191 ?premiereDate . }
      OPTIONAL { ?item wdt:P2047 ?duration . }
      OPTIONAL {
        ?item wdt:P57 ?director .
        ?director rdfs:label ?directorLabel .
        FILTER(LANG(?directorLabel) = "en")
      }
      OPTIONAL {
        ?item wdt:P86 ?composer .
        ?composer rdfs:label ?composerLabel .
        FILTER(LANG(?composerLabel) = "en")
      }
      OPTIONAL {
        ?item wdt:P676 ?lyricist .
        ?lyricist rdfs:label ?lyricistLabel .
        FILTER(LANG(?lyricistLabel) = "en")
      }
      OPTIONAL {
        ?item wdt:P1809 ?choreographer .
        ?choreographer rdfs:label ?choreographerLabel .
        FILTER(LANG(?choreographerLabel) = "en")
      }
      OPTIONAL {
        ?item schema:description ?description .
        FILTER(LANG(?description) = "en")
      }

      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
    ORDER BY ?premiereDate
    LIMIT ${limit}
  `

  const results = await executeSparqlQuery(query)
  return results.map(mapWikidataToPerformance)
}

// Search for shows by region (city) and optional year range
export async function searchShowsByRegion(
  city: string,
  yearFrom?: number,
  yearTo?: number,
  limit = 50
): Promise<WikidataPerformance[]> {
  // Map city to all relevant Wikidata location entities (non-transitive union)
  const cityLocationSets: { [key: string]: string[] } = {
    'NYC': ['wd:Q60', 'wd:Q11299', 'wd:Q18419'],           // NYC + Manhattan + Brooklyn
    'New York': ['wd:Q60', 'wd:Q11299', 'wd:Q18419'],
    'Manhattan': ['wd:Q11299'],
    'Brooklyn': ['wd:Q18419'],
    'Minneapolis': ['wd:Q36091'],
    'LA': ['wd:Q65'],
    'Los Angeles': ['wd:Q65']
  }

  const locationEntities = cityLocationSets[city]
  if (!locationEntities) {
    throw new Error(`City "${city}" not supported. Use: NYC, Manhattan, Brooklyn, Minneapolis, or LA`)
  }

  // Build location union clauses
  const locationUnion = locationEntities
    .map(e => `{ ?venue wdt:P131 ${e} . }`)
    .join(' UNION ')

  // Date filters
  const dateFilters = []
  if (yearFrom) dateFilters.push(`FILTER(YEAR(?premiereDate) >= ${yearFrom})`)
  if (yearTo) dateFilters.push(`FILTER(YEAR(?premiereDate) <= ${yearTo})`)

  const query = `
    SELECT DISTINCT ?item ?itemLabel ?venue ?venueLabel
                    ?premiereDate ?director ?directorLabel ?description ?duration
                    ?composer ?composerLabel WHERE {

      # Premiered at a venue in the target city (non-transitive, explicit union)
      ?item wdt:P4647 ?venue .
      ${locationUnion}

      # Must have a premiere date
      ?item wdt:P1191 ?premiereDate .
      ${dateFilters.join('\n      ')}

      ?item rdfs:label ?itemLabel .
      FILTER(LANG(?itemLabel) = "en")
      ?venue rdfs:label ?venueLabel .
      FILTER(LANG(?venueLabel) = "en")

      OPTIONAL { ?item wdt:P2047 ?duration . }
      OPTIONAL {
        ?item wdt:P57 ?director .
        ?director rdfs:label ?directorLabel .
        FILTER(LANG(?directorLabel) = "en")
      }
      OPTIONAL {
        ?item wdt:P86 ?composer .
        ?composer rdfs:label ?composerLabel .
        FILTER(LANG(?composerLabel) = "en")
      }
      OPTIONAL {
        ?item schema:description ?description .
        FILTER(LANG(?description) = "en")
      }

      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
    ORDER BY DESC(?premiereDate)
    LIMIT ${limit}
  `

  const results = await executeSparqlQuery(query)
  return results.map(mapWikidataToPerformance)
}

// Search for venues in a city — enhanced with capacity, architect, owner
export async function searchVenuesInCity(city: string, limit = 50): Promise<WikidataVenue[]> {
  const cityMappings: { [key: string]: string } = {
    'NYC': 'wd:Q60',
    'New York': 'wd:Q60',
    'Manhattan': 'wd:Q11299',
    'Brooklyn': 'wd:Q18419',
    'Minneapolis': 'wd:Q36091',
    'LA': 'wd:Q65',
    'Los Angeles': 'wd:Q65'
  }

  const cityEntity = cityMappings[city]
  if (!cityEntity) {
    throw new Error(`City "${city}" not supported. Use: NYC, Manhattan, Brooklyn, Minneapolis, or LA`)
  }

  const query = `
    SELECT DISTINCT ?venue ?venueLabel ?coordinates ?website ?capacity
                    ?architect ?architectLabel ?openedDate ?owner ?ownerLabel WHERE {

      # Theaters, concert halls, performing arts centers
      {
        ?venue wdt:P31 wd:Q24354 .        # theater (building)
      } UNION {
        ?venue wdt:P31 wd:Q18674739 .     # performing arts center
      } UNION {
        ?venue wdt:P31 wd:Q15206070 .     # concert hall
      } UNION {
        ?venue wdt:P31 wd:Q57660343 .     # Broadway theater
      }

      ?venue wdt:P131+ ${cityEntity} .

      OPTIONAL { ?venue wdt:P625 ?coordinates . }
      OPTIONAL { ?venue wdt:P856 ?website . }
      OPTIONAL { ?venue wdt:P1083 ?capacity . }
      OPTIONAL {
        ?venue wdt:P84 ?architect .
        ?architect rdfs:label ?architectLabel .
        FILTER(LANG(?architectLabel) = "en")
      }
      OPTIONAL { ?venue wdt:P1619 ?openedDate . }
      OPTIONAL {
        ?venue wdt:P127 ?owner .
        ?owner rdfs:label ?ownerLabel .
        FILTER(LANG(?ownerLabel) = "en")
      }

      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
    LIMIT ${limit}
  `

  const results = await executeSparqlQuery(query)
  return results.map(mapWikidataToVenue)
}

// Search for performances by a specific company/theater
export async function searchPerformancesByCompany(companyName: string, limit = 30): Promise<WikidataPerformance[]> {
  const query = `
    SELECT DISTINCT ?item ?itemLabel ?performanceType ?performanceTypeLabel ?venue ?venueLabel
                    ?premiereDate ?director ?directorLabel ?description WHERE {

      ?company rdfs:label ?companyLabel .
      FILTER(CONTAINS(LCASE(?companyLabel), "${companyName.toLowerCase()}"))
      FILTER(LANG(?companyLabel) = "en")

      ?item wdt:P272 ?company .
      ?item wdt:P31/wdt:P279* wd:Q25379 .

      ?item rdfs:label ?itemLabel .
      FILTER(LANG(?itemLabel) = "en")

      OPTIONAL {
        ?item wdt:P136 ?performanceType .
        ?performanceType rdfs:label ?performanceTypeLabel .
        FILTER(LANG(?performanceTypeLabel) = "en")
      }
      OPTIONAL {
        ?item wdt:P4647 ?venue .
        ?venue rdfs:label ?venueLabel .
        FILTER(LANG(?venueLabel) = "en")
      }
      OPTIONAL { ?item wdt:P1191 ?premiereDate . }
      OPTIONAL {
        ?item wdt:P57 ?director .
        ?director rdfs:label ?directorLabel .
        FILTER(LANG(?directorLabel) = "en")
      }
      OPTIONAL {
        ?item schema:description ?description .
        FILTER(LANG(?description) = "en")
      }

      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
    ORDER BY DESC(?premiereDate)
    LIMIT ${limit}
  `

  const results = await executeSparqlQuery(query)
  return results.map(mapWikidataToPerformance)
}

// Get detailed info about a specific Wikidata entity
export async function getPerformanceDetails(wikidataId: string): Promise<WikidataPerformance | null> {
  const id = extractWikidataId(wikidataId)

  const query = `
    SELECT ?item ?itemLabel ?performanceType ?performanceTypeLabel ?venue ?venueLabel
           ?location ?locationLabel ?premiereDate ?director ?directorLabel
           ?company ?companyLabel ?description ?coordinates ?duration
           ?composer ?composerLabel ?lyricist ?lyricistLabel
           ?choreographer ?choreographerLabel WHERE {

      VALUES ?item { wd:${id} }

      ?item rdfs:label ?itemLabel .
      FILTER(LANG(?itemLabel) = "en")

      OPTIONAL {
        ?item wdt:P136 ?performanceType .
        ?performanceType rdfs:label ?performanceTypeLabel .
        FILTER(LANG(?performanceTypeLabel) = "en")
      }
      OPTIONAL {
        ?item wdt:P4647 ?venue .
        ?venue rdfs:label ?venueLabel .
        FILTER(LANG(?venueLabel) = "en")
        OPTIONAL {
          ?venue wdt:P131 ?location .
          ?location rdfs:label ?locationLabel .
          FILTER(LANG(?locationLabel) = "en")
        }
        OPTIONAL { ?venue wdt:P625 ?coordinates . }
      }
      OPTIONAL { ?item wdt:P1191 ?premiereDate . }
      OPTIONAL { ?item wdt:P2047 ?duration . }
      OPTIONAL {
        ?item wdt:P57 ?director .
        ?director rdfs:label ?directorLabel .
        FILTER(LANG(?directorLabel) = "en")
      }
      OPTIONAL {
        ?item wdt:P86 ?composer .
        ?composer rdfs:label ?composerLabel .
        FILTER(LANG(?composerLabel) = "en")
      }
      OPTIONAL {
        ?item wdt:P676 ?lyricist .
        ?lyricist rdfs:label ?lyricistLabel .
        FILTER(LANG(?lyricistLabel) = "en")
      }
      OPTIONAL {
        ?item wdt:P1809 ?choreographer .
        ?choreographer rdfs:label ?choreographerLabel .
        FILTER(LANG(?choreographerLabel) = "en")
      }
      OPTIONAL {
        ?item wdt:P272 ?company .
        ?company rdfs:label ?companyLabel .
        FILTER(LANG(?companyLabel) = "en")
      }
      OPTIONAL {
        ?item schema:description ?description .
        FILTER(LANG(?description) = "en")
      }

      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
  `

  const results = await executeSparqlQuery(query)
  return results.length > 0 ? mapWikidataToPerformance(results[0]) : null
}

// Get venue details by Wikidata ID
export async function getVenueDetails(wikidataId: string): Promise<WikidataVenue | null> {
  const id = extractWikidataId(wikidataId)

  const query = `
    SELECT ?venue ?venueLabel ?coordinates ?website ?capacity ?address
           ?architect ?architectLabel ?openedDate ?owner ?ownerLabel
           ?cityLabel WHERE {

      VALUES ?venue { wd:${id} }

      OPTIONAL { ?venue wdt:P625 ?coordinates . }
      OPTIONAL { ?venue wdt:P856 ?website . }
      OPTIONAL { ?venue wdt:P1083 ?capacity . }
      OPTIONAL {
        ?venue wdt:P6375 ?address .
        FILTER(LANG(?address) = "en")
      }
      OPTIONAL {
        ?venue wdt:P84 ?architect .
        ?architect rdfs:label ?architectLabel .
        FILTER(LANG(?architectLabel) = "en")
      }
      OPTIONAL { ?venue wdt:P1619 ?openedDate . }
      OPTIONAL {
        ?venue wdt:P127 ?owner .
        ?owner rdfs:label ?ownerLabel .
        FILTER(LANG(?ownerLabel) = "en")
      }
      OPTIONAL {
        ?venue wdt:P131 ?city .
        ?city rdfs:label ?cityLabel .
        FILTER(LANG(?cityLabel) = "en")
      }

      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
  `

  const results = await executeSparqlQuery(query)
  return results.length > 0 ? mapWikidataToVenue(results[0]) : null
}

// --- Wikipedia REST API Layer ---

// Get a clean summary (intro paragraph, thumbnail, Wikidata ID) for any Wikipedia article
export async function getWikipediaSummary(title: string): Promise<WikipediaSummary | null> {
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'))
    const response = await axios.get(`${WIKIPEDIA_REST_BASE}/page/summary/${encoded}`, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })

    const data = response.data
    if (data.type === 'disambiguation') return null

    return {
      title: data.title,
      extract: data.extract || '',
      description: data.description,
      thumbnail: data.thumbnail ? {
        source: data.thumbnail.source,
        width: data.thumbnail.width,
        height: data.thumbnail.height
      } : undefined,
      wikidataId: data.wikibase_item,
      pageUrl: data.content_urls?.desktop?.page || ''
    }
  } catch (error: any) {
    if (error.response?.status === 404) return null
    console.error(`Wikipedia summary failed for "${title}":`, error.message)
    return null
  }
}

// Get the full intro section as plaintext (longer than summary extract)
export async function getWikipediaIntro(title: string): Promise<string | null> {
  try {
    const response = await axios.get(WIKIPEDIA_ACTION_BASE, {
      params: {
        action: 'query',
        titles: title,
        prop: 'extracts',
        exintro: 1,
        explaintext: 1,
        format: 'json'
      },
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    })

    const pages = response.data.query.pages
    const page = Object.values(pages)[0] as any
    if (page.missing !== undefined) return null
    return page.extract || null
  } catch (error: any) {
    console.error(`Wikipedia intro failed for "${title}":`, error.message)
    return null
  }
}

// --- Category Crawling ---

// Get members of a Wikipedia category (pages and/or subcategories)
export async function getCategoryMembers(
  categoryTitle: string,
  type: 'page' | 'subcat' | 'both' = 'both',
  limit = 50
): Promise<CategoryMember[]> {
  const cmtype = type === 'both' ? 'subcat|page' : type
  const members: CategoryMember[] = []
  let cmcontinue: string | undefined

  do {
    const params: any = {
      action: 'query',
      list: 'categorymembers',
      cmtitle: categoryTitle.startsWith('Category:') ? categoryTitle : `Category:${categoryTitle}`,
      cmtype,
      cmlimit: Math.min(limit - members.length, 50),
      format: 'json'
    }
    if (cmcontinue) params.cmcontinue = cmcontinue

    try {
      const response = await axios.get(WIKIPEDIA_ACTION_BASE, {
        params,
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000
      })

      const data = response.data
      const batch = (data.query?.categorymembers || []).map((m: any) => ({
        title: m.title,
        pageid: m.pageid,
        ns: m.ns
      }))
      members.push(...batch)

      cmcontinue = data.continue?.cmcontinue
    } catch (error: any) {
      console.error(`Category crawl failed for "${categoryTitle}":`, error.message)
      break
    }

    // Be polite — 1 req/s for pagination
    if (cmcontinue && members.length < limit) {
      await delay(1000)
    }
  } while (cmcontinue && members.length < limit)

  return members
}

// Recursively crawl a category tree to a given depth, collecting article pages
export async function crawlCategoryTree(
  rootCategory: string,
  maxDepth = 2,
  maxPages = 200
): Promise<CategoryMember[]> {
  const pages: CategoryMember[] = []
  const visited = new Set<string>()

  async function crawl(category: string, depth: number) {
    if (depth > maxDepth || pages.length >= maxPages || visited.has(category)) return
    visited.add(category)

    console.log(`  Crawling: ${category} (depth ${depth})`)
    const members = await getCategoryMembers(category, 'both', 500)
    await delay(1000)

    for (const member of members) {
      if (pages.length >= maxPages) break

      if (member.ns === 0) {
        // Article page
        if (!pages.some(p => p.pageid === member.pageid)) {
          pages.push(member)
        }
      } else if (member.ns === 14 && depth < maxDepth) {
        // Subcategory — recurse
        await crawl(member.title, depth + 1)
      }
    }
  }

  await crawl(rootCategory, 0)
  return pages
}

// --- Mappers ---

function mapWikidataToPerformance(result: any): WikidataPerformance {
  return {
    item: result.item?.value || '',
    itemLabel: result.itemLabel?.value || '',
    performanceType: result.performanceType?.value,
    performanceTypeLabel: result.performanceTypeLabel?.value,
    venue: result.venue?.value,
    venueLabel: result.venueLabel?.value,
    location: result.location?.value,
    locationLabel: result.locationLabel?.value,
    premiereDate: result.premiereDate?.value,
    director: result.director?.value,
    directorLabel: result.directorLabel?.value,
    company: result.company?.value,
    companyLabel: result.companyLabel?.value,
    description: result.description?.value,
    coordinates: result.coordinates?.value,
    duration: result.duration?.value,
    composer: result.composer?.value,
    composerLabel: result.composerLabel?.value,
    lyricist: result.lyricist?.value,
    lyricistLabel: result.lyricistLabel?.value,
    choreographer: result.choreographer?.value,
    choreographerLabel: result.choreographerLabel?.value
  }
}

function mapWikidataToVenue(result: any): WikidataVenue {
  return {
    venue: result.venue?.value || '',
    venueLabel: result.venueLabel?.value || '',
    address: result.address?.value,
    coordinates: result.coordinates?.value,
    city: result.city?.value,
    cityLabel: result.cityLabel?.value,
    capacity: result.capacity?.value,
    venueType: result.venueType?.value,
    website: result.website?.value,
    architect: result.architect?.value,
    architectLabel: result.architectLabel?.value,
    openedDate: result.openedDate?.value,
    owner: result.owner?.value,
    ownerLabel: result.ownerLabel?.value
  }
}

// --- Exports ---

export { extractWikidataId, parseCoordinates, delay }

export const WikidataAPI = {
  // SPARQL searches
  searchTheatricalPerformances,
  searchShowsByRegion,
  searchVenuesInCity,
  searchPerformancesByCompany,
  getPerformanceDetails,
  getVenueDetails,
  // Wikipedia REST
  getWikipediaSummary,
  getWikipediaIntro,
  // Category crawling
  getCategoryMembers,
  crawlCategoryTree,
  // Helpers
  extractWikidataId,
  parseCoordinates
}
