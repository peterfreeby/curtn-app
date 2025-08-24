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
}

export async function scrapeCaveatEventsPlaywright(): Promise<CaveatEvent[]> {
  let browser
  try {
    console.log('🎭 Starting Playwright browser to scrape Caveat NYC...')
    
    // Launch browser
    browser = await chromium.launch({ 
      headless: true, // Set to false if you want to see the browser window
      timeout: 30000 
    })
    
    const page = await browser.newPage()
    
    // Go to Caveat
    console.log('🌐 Loading caveat.nyc...')
    await page.goto('https://caveat.nyc/', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    })
    
    // Wait a bit for JavaScript to load events
    console.log('⏳ Waiting for events to load...')
    await page.waitForTimeout(3000)
    
    // Try to find events - we'll try multiple selectors
    console.log('🔍 Looking for event elements...')
    
    // First, let's see what's actually on the page
    const pageContent = await page.evaluate(() => {
      return {
        title: document.title,
        bodyText: document.body.innerText.substring(0, 500),
        allText: document.body.innerText.includes('JUN') || document.body.innerText.includes('TICKETS'),
        linkCount: document.querySelectorAll('a').length
      }
    })
    
    console.log('📄 Page Info:', pageContent)
    
    // Look for events using various selectors
    const events = await page.evaluate(() => {
      const eventElements: any[] = []
      
      // Try different selectors that might contain events
      const selectors = [
        '[class*="event"]',
        '[class*="show"]', 
        '[class*="card"]',
        '[class*="item"]',
        'div[class*="Event"]',
        'div[class*="Show"]',
        '*:has-text("JUN")',
        '*:has-text("TICKETS")'
      ]
      
      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector)
          console.log(`Selector ${selector}: found ${elements.length} elements`)
          
          elements.forEach((el, index) => {
            const text = el.textContent?.trim() || ''
            if (text.length > 10 && (
              text.includes('JUN') || 
              text.includes('TICKETS') ||
              text.includes('PM') ||
              text.includes('AM')
            )) {
              eventElements.push({
                selector: selector,
                index: index,
                text: text.substring(0, 200),
                hasTicketLink: el.querySelector('a[href*="ticket"]') !== null,
                hasEventbriteLink: el.querySelector('a[href*="eventbrite"]') !== null
              })
            }
          })
        } catch (e) {
          // Selector might not be supported, continue
        }
      }
      
      return eventElements
    })
    
    console.log(`🎫 Found ${events.length} potential event elements:`)
    events.forEach((event, i) => {
      console.log(`  ${i + 1}. [${event.selector}] ${event.text.substring(0, 100)}...`)
      if (event.hasTicketLink) console.log(`     ✅ Has ticket link`)
      if (event.hasEventbriteLink) console.log(`     🎟️ Has Eventbrite link`)
    })
    
    // Convert to our event format (simplified for now)
    const caveatEvents: CaveatEvent[] = events.map((event, index) => ({
      title: event.text.split('\n')[0] || `Event ${index + 1}`,
      description: event.text,
      date: event.text.match(/JUN \d+/)?.[0] || '',
      time: event.text.match(/\d+:\d+ PM|\d+:\d+ AM/)?.[0] || '',
      ticketUrl: event.hasEventbriteLink ? 'Found Eventbrite link' : undefined,
      eventType: 'comedy/performance'
    }))
    
    return caveatEvents
    
  } catch (error: any) {
    console.error('❌ Error scraping Caveat with Playwright:', error.message)
    return []
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

export async function debugCaveatPlaywright(): Promise<void> {
  let browser
  try {
    console.log('🔍 DEBUGGING CAVEAT WITH PLAYWRIGHT')
    console.log('=====================================')
    
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    
    await page.goto('https://caveat.nyc/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'caveat-debug.png', fullPage: true })
    console.log('📸 Screenshot saved as caveat-debug.png')
    
    // Get detailed page info
    const pageInfo = await page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      bodyText: document.body.innerText,
      allElements: document.querySelectorAll('*').length,
      divs: document.querySelectorAll('div').length,
      links: document.querySelectorAll('a').length,
      hasJun: document.body.innerText.includes('JUN'),
      hasTickets: document.body.innerText.includes('TICKETS'),
      hasEventbrite: document.body.innerText.includes('eventbrite')
    }))
    
    console.log('📊 Page Analysis:')
    console.log(`  Title: ${pageInfo.title}`)
    console.log(`  Total elements: ${pageInfo.allElements}`)
    console.log(`  Divs: ${pageInfo.divs}`)
    console.log(`  Links: ${pageInfo.links}`)
    console.log(`  Contains "JUN": ${pageInfo.hasJun}`)
    console.log(`  Contains "TICKETS": ${pageInfo.hasTickets}`)
    console.log(`  Contains "eventbrite": ${pageInfo.hasEventbrite}`)
    console.log(`\n📝 First 1000 chars of page text:`)
    console.log(pageInfo.bodyText.substring(0, 1000))
    
  } catch (error) {
    console.error('Error debugging with Playwright:', error)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

export const CaveatScraperPlaywright = {
  scrapeEvents: scrapeCaveatEventsPlaywright,
  debugStructure: debugCaveatPlaywright
}
