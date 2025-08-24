import axios from 'axios'
import * as cheerio from 'cheerio'

export interface CaveatEvent {
  title: string
  description?: string
  date: string
  time?: string
  ticketUrl?: string
  price?: string
  eventType?: string
  imageUrl?: string
  soldOut?: boolean
}

export async function scrapeCaveatEvents(): Promise<CaveatEvent[]> {
  try {
    console.log('🎭 Scraping Caveat NYC events...')
    
    const response = await axios.get('https://caveat.nyc/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    })

    const $ = cheerio.load(response.data)
    const events: CaveatEvent[] = []

    console.log('📄 Page loaded, parsing events...')

    // Look for any links that might be events
    $('a').each((index, element) => {
      const linkText = $(element).text().trim()
      const href = $(element).attr('href')
      
      if (linkText.length > 10 && href && (
        href.includes('event') || 
        href.includes('show') || 
        href.includes('ticket') ||
        linkText.toLowerCase().includes('pm') ||
        linkText.toLowerCase().includes('am')
      )) {
        const eventData: CaveatEvent = {
          title: linkText,
          ticketUrl: href.startsWith('http') ? href : `https://caveat.nyc${href}`,
          date: linkText
        }
        
        if (eventData.title.length < 200) {
          events.push(eventData)
        }
      }
    })

    console.log(`✅ Found ${events.length} potential events`)
    return events

  } catch (error: any) {
    console.error('❌ Error scraping Caveat events:', error.message)
    return []
  }
}

export async function debugCaveatStructure(): Promise<void> {
  try {
    const response = await axios.get('https://caveat.nyc/')
    const $ = cheerio.load(response.data)
    
    console.log('🔍 DEBUGGING CAVEAT PAGE STRUCTURE')
    console.log('=====================================')
    
    // Show page title
    console.log(`📄 Page Title: ${$('title').text()}`)
    
    // Show all text content (first 500 chars)
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
    console.log(`📝 Body Text (first 500 chars): ${bodyText.substring(0, 500)}...`)
    
    // Count total links
    console.log(`🔗 Total Links Found: ${$('a').length}`)
    
    // Show ALL links (not just first 15)
    console.log('\n🔗 All Links:')
    $('a').each((index, element) => {
      const href = $(element).attr('href')
      const text = $(element).text().trim()
      if (text || href) {
        console.log(`  ${index + 1}. "${text}" → ${href}`)
      }
    })
    
    // Look for common event-related elements
    console.log('\n🎭 Looking for event-related elements:')
    const eventSelectors = ['[class*="event"]', '[class*="show"]', '[class*="ticket"]', '[id*="event"]']
    eventSelectors.forEach(selector => {
      const count = $(selector).length
      if (count > 0) {
        console.log(`  ${selector}: ${count} elements`)
      }
    })

  } catch (error) {
    console.error('Error debugging page structure:', error)
  }
}

export const CaveatScraper = {
  scrapeEvents: scrapeCaveatEvents,
  debugStructure: debugCaveatStructure
}
