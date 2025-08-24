import { chromium } from 'playwright'

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
  isRecurring?: boolean
  venue?: string
}

export async function scrapeCaveatEventsClean(): Promise<CaveatEvent[]> {
  let browser
  try {
    console.log('🎭 Starting improved Caveat scraper...')
    
    browser = await chromium.launch({ headless: true, timeout: 30000 })
    const page = await browser.newPage()
    
    await page.goto('https://caveat.nyc/', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    })
    
    console.log('⏳ Waiting for events to load...')
    await page.waitForTimeout(3000)
    
    // Extract events with better parsing
    const events = await page.evaluate(() => {
      const eventElements: any[] = []
      
      // Look for event containers
      const containers = document.querySelectorAll('[class*="item"]')
      
      console.log(`Found ${containers.length} potential event containers`)
      
      containers.forEach((container, index) => {
        const text = container.textContent?.trim() || ''
        
        // Skip if too short or generic
        if (text.length < 20) return
        
        // Check if this is a specific dated event (has JUN XX pattern)
        const dateMatch = text.match(/JUN\s+(\d{1,2})\s+(\d{1,2}:\d{2}\s+[AP]M)/i)
        const isSpecificEvent = dateMatch !== null
        
        // Extract title (usually the first line or before date)
        let title = ''
        if (isSpecificEvent && dateMatch) {
          // For dated events, title is usually after the date
          const afterDate = text.split(dateMatch[0])[1]
          title = afterDate?.split('\n')[0]?.trim() || afterDate?.split(/In-person|Livestream/)[0]?.trim() || ''
        } else {
          // For recurring shows, title is usually first line
          title = text.split('\n')[0]?.trim() || ''
        }
        
        // Clean up title
        title = title
            .replace(/GET TICKETS.*$/, '')
            .replace(/In-person.*$/, '')
            .replace(/Livestream.*$/, '')
            .replace(/See more.*$/, '')
            .replace(/TICKETS.*$/, '')
            .replace(/LIVESTREAM.*$/, '')
            .trim()
        
        // Extract description
        const lines = text.split('\n').filter(line => line.trim())
        let description = ''
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim()
          if (line && 
              !line.includes('GET TICKETS') && 
              !line.includes('TICKETS') &&
              !line.includes('LIVESTREAM') &&
              !line.includes('In-person') &&
              !line.includes('See more')) {
            description = line
            break
          }
        }
        
        // Look for ticket links
        const ticketLinks = container.querySelectorAll('a[href*="eventbrite"], a[href*="ticket"]')
        let ticketUrl = ''
        if (ticketLinks.length > 0) {
          ticketUrl = (ticketLinks[0] as HTMLAnchorElement).href
        }
        
        // Only add if we have a meaningful title
        if (title && title.length > 3 && !title.includes('COMEDY. IMPROV.')) {
          eventElements.push({
            title: title,
            description: description,
            date: isSpecificEvent ? dateMatch?.[0] || '' : '',
            time: isSpecificEvent ? dateMatch?.[2] || '' : '',
            rawText: text.substring(0, 200), // for debugging
            ticketUrl: ticketUrl,
            isRecurring: !isSpecificEvent,
            hasEventbriteLink: ticketUrl.includes('eventbrite')
          })
        }
      })
      
      return eventElements
    })
    
    console.log(`🎫 Processed ${events.length} events:`)
    
    // Convert to our event format with better structure
    const caveatEvents: CaveatEvent[] = events.map((event, index) => {
      // Parse date better
      let cleanDate = event.date
      let cleanTime = event.time
      
      if (event.date) {
        const dateMatch = event.date.match(/JUN\s+(\d{1,2})/)
        if (dateMatch) {
          cleanDate = `June ${dateMatch[1]}, 2024` // Assuming current year
        }
      }
      
      return {
        title: event.title,
        description: event.description || undefined,
        date: cleanDate,
        time: cleanTime,
        ticketUrl: event.ticketUrl || undefined,
        eventType: 'comedy/performance',
        isRecurring: event.isRecurring,
        venue: 'Caveat NYC',
        soldOut: event.rawText?.toLowerCase().includes('sold out') || false
      }
    })
    
    // Separate specific events from recurring shows
    const specificEvents = caveatEvents.filter(e => !e.isRecurring && e.date)
    const recurringShows = caveatEvents.filter(e => e.isRecurring)
    
    console.log(`📅 Found ${specificEvents.length} specific dated events:`)
    specificEvents.forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.title} - ${event.date} ${event.time}`)
      if (event.ticketUrl) console.log(`     🎫 ${event.ticketUrl}`)
    })
    
    console.log(`\n🔄 Found ${recurringShows.length} recurring shows:`)
    recurringShows.forEach((show, i) => {
      console.log(`  ${i + 1}. ${show.title}`)
    })
    
    return specificEvents // Return only specific events for now
    
  } catch (error: any) {
    console.error('❌ Error in improved scraper:', error.message)
    return []
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

export const CaveatScraperV2 = {
  scrapeEvents: scrapeCaveatEventsClean
}