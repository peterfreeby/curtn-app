import { EventbriteAPI } from './api'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '../../../.env' })

async function testEventbriteAPI() {
  console.log('🎫 TESTING EVENTBRITE API INTEGRATION\n')

  try {
    // Test 1: Search for theater events in NYC
    console.log('🎭 SEARCHING FOR THEATER EVENTS IN NYC...')
    const nycTheaterEvents = await EventbriteAPI.searchTheaterEvents('NYC', {
      limit: 5,
      startDate: new Date().toISOString() // Only future events
    })
    
    console.log(`Found ${nycTheaterEvents.length} theater events in NYC:`)
    nycTheaterEvents.forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.name.text}`)
      console.log(`     Date: ${new Date(event.start.local).toLocaleDateString()}`)
      console.log(`     Time: ${new Date(event.start.local).toLocaleTimeString()}`)
      if (event.venue?.name) console.log(`     Venue: ${event.venue.name}`)
      if (event.url) console.log(`     Tickets: ${event.url}`)
      if (event.ticket_availability?.minimum_ticket_price) {
        console.log(`     Price from $${event.ticket_availability.minimum_ticket_price.major_value}`)
      }
      console.log()
    })

    // Test 2: Search for performance events in Minneapolis
    console.log('\n🎪 SEARCHING FOR PERFORMANCE EVENTS IN MINNEAPOLIS...')
    const minneapolisEvents = await EventbriteAPI.searchPerformanceEvents('Minneapolis', {
      limit: 5,
      startDate: new Date().toISOString()
    })
    
    console.log(`Found ${minneapolisEvents.length} performance events in Minneapolis:`)
    minneapolisEvents.forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.name.text}`)
      console.log(`     Date: ${new Date(event.start.local).toLocaleDateString()}`)
      if (event.organizer?.name) console.log(`     Organizer: ${event.organizer.name}`)
      if (event.venue?.name) console.log(`     Venue: ${event.venue.name}`)
      console.log()
    })

    // Test 3: Search for specific events (Hamilton example)
    console.log('\n🎵 SEARCHING FOR "HAMILTON" EVENTS...')
    const hamiltonEvents = await EventbriteAPI.searchTheaterEvents('NYC', {
      query: 'Hamilton',
      limit: 3,
      startDate: new Date().toISOString()
    })
    
    console.log(`Found ${hamiltonEvents.length} Hamilton-related events:`)
    hamiltonEvents.forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.name.text}`)
      console.log(`     Date: ${new Date(event.start.local).toLocaleDateString()}`)
      if (event.venue?.name) console.log(`     Venue: ${event.venue.name}`)
      if (event.description?.text) {
        const desc = event.description.text.substring(0, 100)
        console.log(`     Description: ${desc}${desc.length === 100 ? '...' : ''}`)
      }
      console.log()
    })

    // Test 4: Search for LA events
    console.log('\n🌴 SEARCHING FOR PERFORMANCE EVENTS IN LA...')
    const laEvents = await EventbriteAPI.searchPerformanceEvents('LA', {
      limit: 5,
      startDate: new Date().toISOString()
    })
    
    console.log(`Found ${laEvents.length} performance events in LA:`)
    laEvents.forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.name.text}`)
      console.log(`     Date: ${new Date(event.start.local).toLocaleDateString()}`)
      if (event.venue?.address?.city) {
        console.log(`     Location: ${event.venue.address.city}`)
      }
      if (event.venue?.name) console.log(`     Venue: ${event.venue.name}`)
      console.log()
    })

    // Test 5: Get available categories to understand what Eventbrite has
    console.log('\n📂 AVAILABLE EVENTBRITE CATEGORIES...')
    const categories = await EventbriteAPI.getCategories()
    const relevantCategories = categories.filter(cat => 
      cat.name.toLowerCase().includes('music') ||
      cat.name.toLowerCase().includes('performing') ||
      cat.name.toLowerCase().includes('arts') ||
      cat.name.toLowerCase().includes('entertainment') ||
      cat.name.toLowerCase().includes('culture')
    )
    
    console.log(`Found ${relevantCategories.length} performance-related categories:`)
    relevantCategories.forEach((cat, i) => {
      console.log(`  ${i + 1}. ${cat.name} (ID: ${cat.id})`)
    })

  } catch (error: any) {
    console.error('❌ Error testing Eventbrite API:', error.message)
    
    if (error.message.includes('401')) {
      console.error('🔑 Check your EVENTBRITE_API_TOKEN in .env file')
    } else if (error.message.includes('429')) {
      console.error('⏰ Rate limit exceeded - wait a moment and try again')
    }
  }
}

// Run the test
testEventbriteAPI()
  .then(() => {
    console.log('\n✅ Eventbrite API test completed!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 Test failed:', error)
    process.exit(1)
  })