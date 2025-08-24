import axios from 'axios'

// Wikidata SPARQL endpoint
const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'

// Types for Wikidata responses
export interface WikidataPerformance {
  item: string
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
}

export interface WikidataVenue {
  venue: string
  venueLabel: string
  address?: string
  coordinates?: string
  city?: string
  cityLabel?: string
  capacity?: string
  venueType?: string
  website?: string
}

// Helper function to execute SPARQL queries
async function executeSparqlQuery(query: string): Promise<any> {
  try {
    const response = await axios.get(WIKIDATA_SPARQL_ENDPOINT, {
      params: {
        query,
        format: 'json'
      },
      headers: {
        'User-Agent': 'StageLog/1.0 (https://stagelog.app) Performance Review Platform'
      },
      timeout: 30000 // 30 second timeout
    })

    return response.data.results.bindings
  } catch (error) {
    console.error('Wikidata SPARQL query failed:', error)
    throw new Error(`Wikidata query failed: ${error}`)
  }
}

// Search for theatrical performances (more targeted)
export async function searchTheatricalPerformances(searchTerm: string, limit = 20): Promise<WikidataPerformance[]> {
  const query = `
    SELECT DISTINCT ?item ?itemLabel ?performanceType ?performanceTypeLabel ?venue ?venueLabel 
                    ?location ?locationLabel ?premiereDate ?director ?directorLabel 
                    ?company ?companyLabel ?description WHERE {
      
      # More specific: musicals, plays, operas
      {
        ?item wdt:P31 wd:Q2743 .  # musical
      } UNION {
        ?item wdt:P31 wd:Q25379 .  # theatrical work
      } UNION {
        ?item wdt:P31 wd:Q1344 .  # opera
      } UNION {
        ?item wdt:P31 wd:Q16623671 .  # musical theatre production
      }
      
      # Text search in title
      ?item rdfs:label ?itemLabel .
      FILTER(CONTAINS(LCASE(?itemLabel), "${searchTerm.toLowerCase()}"))
      FILTER(LANG(?itemLabel) = "en")
      
      # Filter OUT television episodes and sketches
      FILTER NOT EXISTS { ?item wdt:P31 wd:Q21191270 }  # not television episode
      FILTER NOT EXISTS { ?item wdt:P31 wd:Q1261214 }   # not sketch
      FILTER NOT EXISTS { ?item wdt:P179 ?series }       # not part of TV series
      
      # Optional: Get performance type
      OPTIONAL {
        ?item wdt:P136 ?performanceType .
        ?performanceType rdfs:label ?performanceTypeLabel .
        FILTER(LANG(?performanceTypeLabel) = "en")
      }
      
      # Optional: Get premiere venue (simplified)
      OPTIONAL {
        ?item wdt:P4647 ?venue .
        ?venue rdfs:label ?venueLabel .
        FILTER(LANG(?venueLabel) = "en")
      }
      
      # Optional: Get premiere date
      OPTIONAL {
        ?item wdt:P1191 ?premiereDate .
      }
      
      # Optional: Get director
      OPTIONAL {
        ?item wdt:P57 ?director .
        ?director rdfs:label ?directorLabel .
        FILTER(LANG(?directorLabel) = "en")
      }
      
      # Optional: Get description
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

// Search for venues in specific cities (simplified to avoid timeout)
export async function searchVenuesInCity(city: string, limit = 10): Promise<WikidataVenue[]> {
  // Map our city names to Wikidata entities
  const cityMappings: { [key: string]: string } = {
    'NYC': 'wd:Q60',           // New York City
    'New York': 'wd:Q60',
    'Minneapolis': 'wd:Q36091', // Minneapolis
    'LA': 'wd:Q65',            // Los Angeles
    'Los Angeles': 'wd:Q65'
  }

  const cityEntity = cityMappings[city]
  if (!cityEntity) {
    throw new Error(`City "${city}" not supported. Use: NYC, Minneapolis, or LA`)
  }

  // Simplified query - just get basic theater info to avoid timeout
  const query = `
    SELECT DISTINCT ?venue ?venueLabel ?coordinates ?website WHERE {
      
      # Just theaters to keep it simple
      ?venue wdt:P31 wd:Q24354 .  # theater
      
      # Must be located in the specified city (direct location only)
      ?venue wdt:P131 ${cityEntity} .
      
      # Optional: Get coordinates
      OPTIONAL {
        ?venue wdt:P625 ?coordinates .
      }
      
      # Optional: Get website
      OPTIONAL {
        ?venue wdt:P856 ?website .
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
      
      # Find the company first
      ?company rdfs:label ?companyLabel .
      FILTER(CONTAINS(LCASE(?companyLabel), "${companyName.toLowerCase()}"))
      FILTER(LANG(?companyLabel) = "en")
      
      # Find performances by this company
      ?item wdt:P272 ?company .  # produced by
      ?item wdt:P31/wdt:P279* wd:Q25379 .  # theatrical work
      
      # Get performance details
      ?item rdfs:label ?itemLabel .
      FILTER(LANG(?itemLabel) = "en")
      
      # Optional fields (same as searchTheatricalPerformances)
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

// Get detailed information about a specific performance
export async function getPerformanceDetails(wikidataId: string): Promise<WikidataPerformance | null> {
  // Extract ID from full Wikidata URL if needed
  const id = wikidataId.replace('http://www.wikidata.org/entity/', '')
  
  const query = `
    SELECT ?item ?itemLabel ?performanceType ?performanceTypeLabel ?venue ?venueLabel 
           ?location ?locationLabel ?premiereDate ?director ?directorLabel 
           ?company ?companyLabel ?description ?coordinates WHERE {
      
      VALUES ?item { wd:${id} }
      
      ?item rdfs:label ?itemLabel .
      FILTER(LANG(?itemLabel) = "en")
      
      # Get all the optional fields
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
        
        OPTIONAL {
          ?venue wdt:P625 ?coordinates .
        }
      }
      
      OPTIONAL { ?item wdt:P1191 ?premiereDate . }
      
      OPTIONAL {
        ?item wdt:P57 ?director .
        ?director rdfs:label ?directorLabel .
        FILTER(LANG(?directorLabel) = "en")
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

// Helper functions to map Wikidata results to our types
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
    coordinates: result.coordinates?.value
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
    website: result.website?.value
  }
}

// Export all functions
export const WikidataAPI = {
  searchTheatricalPerformances,
  searchVenuesInCity,
  searchPerformancesByCompany,
  getPerformanceDetails
}