// packages/server/src/services/scraping/database-integration.ts
import { PerformanceModel } from '../../entities/performance/performanceModel'
import { VenueModel } from '../../entities/venue/venueModel'
import { UserModel } from '../../entities/user/userModel'
import { scrapeCaveatEventsClean, CaveatEvent } from './caveat-scraper-playwright-v2'
import { connectToDatabase } from '../../db/mongoose'
import { Types } from 'mongoose'

export interface IntegrationResult {
  venuesCreated: number
  performancesCreated: number
  performancesUpdated: number
  errors: string[]
}

export class DatabaseIntegrator {
  private async ensureCaveatVenue(systemUserId: string) {
    // Check if Caveat venue already exists
    let caveatVenue = await VenueModel.findOne({ slug: 'caveat-nyc' })
    
    if (!caveatVenue) {
      console.log('🏢 Creating Caveat venue...')
      caveatVenue = new VenueModel({
        name: 'Caveat',
        slug: 'caveat-nyc',
        description: 'A library bar for curious people in the Lower East Side',
        address: '21A Clinton St, New York, NY 10002',
        city: 'NYC',
        state: 'NY',
        zipCode: '10002',
        coordinates: {
          lat: 40.7209, // Approximate coordinates for Caveat
          lng: -73.9837
        },
        capacity: 75, // Approximate capacity
        venueType: 'multi-purpose',
        website: 'https://caveat.nyc',
        submittedBy: new Types.ObjectId(systemUserId)
      })
      
      await caveatVenue.save()
      console.log('✅ Caveat venue created')
    }
    
    return caveatVenue
  }

  private parseEventDate(caveatEvent: CaveatEvent): Date {
    // Parse dates like "June 01, 2024 at 5:00 PM"
    try {
      const dateStr = caveatEvent.date
      if (!dateStr) {
        throw new Error('No date provided')
      }
      
      // Handle various date formats from Caveat
      const parsed = new Date(dateStr.replace(' at ', ' '))
      if (isNaN(parsed.getTime())) {
        throw new Error(`Invalid date format: ${dateStr}`)
      }
      
      return parsed
    } catch (error) {
      console.warn(`⚠️ Date parsing failed for "${caveatEvent.date}":`, error)
      // Default to next week if parsing fails
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      return nextWeek
    }
  }

  private async createPerformanceFromEvent(
    caveatEvent: CaveatEvent, 
    venue: any,
    systemUserId: string
  ) {
    const eventDate = this.parseEventDate(caveatEvent)
    
    // Check if performance already exists (avoid duplicates)
    const existingPerformance = await PerformanceModel.findOne({
      title: caveatEvent.title,
      'performances.date': eventDate,
      venues: venue._id
    })

    if (existingPerformance) {
      console.log(`⏭️ Skipping duplicate: ${caveatEvent.title}`)
      return null
    }

    // Determine performance types based on title/description
    const performanceTypes = this.categorizeEvent(caveatEvent)
    
    const performance = new PerformanceModel({
      title: caveatEvent.title,
      description: caveatEvent.description || 'Performance at Caveat NYC',
      performanceTypes,
      duration: 90, // Default 90 minutes - could be parsed from description
      intermissions: 0,
      languages: ['English'],
      venues: [venue._id],
      company: {
        name: 'Various Artists', // Default - could be parsed from description
        description: 'Independent performance at Caveat'
      },
      performances: [{
        date: eventDate,
        time: this.extractTime(caveatEvent.date),
        venueId: venue._id,
        ticketUrl: caveatEvent.ticketUrl,
        soldOut: caveatEvent.soldOut || false
      }],
      submittedBy: new Types.ObjectId(systemUserId)
    })

    await performance.save()
    console.log(`✅ Created performance: ${caveatEvent.title}`)
    return performance
  }

  private categorizeEvent(event: CaveatEvent): string[] {
    const title = event.title.toLowerCase()
    const description = (event.description || '').toLowerCase()
    const combined = `${title} ${description}`
    
    const types: string[] = []
    
    // Comedy indicators
    if (combined.includes('comedy') || combined.includes('joke') || combined.includes('funny')) {
      types.push('comedy')
    }
    
    // Storytelling indicators
    if (combined.includes('story') || combined.includes('tale') || combined.includes('narrative')) {
      types.push('spoken-word')
    }
    
    // Performance/variety show indicators
    if (combined.includes('show') || combined.includes('performance') || combined.includes('variety')) {
      types.push('experimental')
    }
    
    // Default if no specific type found
    if (types.length === 0) {
      types.push('other')
    }
    
    return types
  }

  private extractTime(dateStr: string): string {
    // Extract time from "June 01, 2024 at 5:00 PM" -> "5:00 PM"
    const match = dateStr.match(/at\s+(.+)$/)
    return match ? match[1] : '7:00 PM' // Default time
  }

  async integrateScrapedData(systemUserId: string): Promise<IntegrationResult> {
    const result: IntegrationResult = {
      venuesCreated: 0,
      performancesCreated: 0,
      performancesUpdated: 0,
      errors: []
    }

    try {
      console.log('🎭 Starting Caveat data integration...')
      
      // Connect to database
      await connectToDatabase()
      
      // Ensure Caveat venue exists
      const venue = await this.ensureCaveatVenue(systemUserId)
      const existingVenue = await VenueModel.findOne({ slug: 'caveat-nyc' })
      if (!existingVenue) {
        result.venuesCreated = 1
      }
      
      // Scrape current events
      console.log('🕷️ Scraping Caveat events...')
      const events = await scrapeCaveatEventsClean()
      console.log(`📊 Found ${events.length} events to process`)
      
      // Process each event
      for (const event of events) {
        try {
          const performance = await this.createPerformanceFromEvent(
            event, 
            venue, 
            systemUserId
          )
          
          if (performance) {
            result.performancesCreated++
          }
        } catch (error) {
          const errorMsg = `Failed to create performance for "${event.title}": ${error}`
          console.error(`❌ ${errorMsg}`)
          result.errors.push(errorMsg)
        }
      }
      
      console.log('🎉 Integration complete!')
      console.log(`📈 Results: ${result.performancesCreated} performances created, ${result.errors.length} errors`)
      
    } catch (error) {
      const errorMsg = `Integration failed: ${error}`
      console.error(`💥 ${errorMsg}`)
      result.errors.push(errorMsg)
    }
    
    return result
  }
}

// Helper function to run integration
export async function integrateCaveatData(systemUserId: string): Promise<IntegrationResult> {
  const integrator = new DatabaseIntegrator()
  return await integrator.integrateScrapedData(systemUserId)
}