import { CaveatScraperPlaywright } from './caveat-scraper-playwright'

async function testCaveatPlaywrightScraper() {
  console.log('🎭 TESTING CAVEAT NYC SCRAPER WITH PLAYWRIGHT')
  console.log('=============================================\n')

  try {
    // First debug the page structure
    console.log('🔍 Step 1: Debugging page with JavaScript rendering...\n')
    await CaveatScraperPlaywright.debugStructure()

    console.log('\n' + '='.repeat(50) + '\n')

    // Then try to scrape events
    console.log('🎫 Step 2: Scraping events with Playwright...\n')
    const events = await CaveatScraperPlaywright.scrapeEvents()

    if (events.length === 0) {
      console.log('❌ No events found with Playwright either.')
      console.log('🤔 This might mean:')
      console.log('   - Events are loaded even later than we waited')
      console.log('   - Events are in an iframe or shadow DOM')
      console.log('   - We need different selectors')
      console.log('   - Check the screenshot: caveat-debug.png')
    } else {
      console.log(`✅ Found ${events.length} events with Playwright:\n`)
      
      events.forEach((event, index) => {
        console.log(`${index + 1}. ${event.title}`)
        if (event.date) console.log(`   📅 Date: ${event.date}`)
        if (event.time) console.log(`   ⏰ Time: ${event.time}`)
        if (event.description) console.log(`   📝 Description: ${event.description.substring(0, 100)}...`)
        if (event.ticketUrl) console.log(`   🎫 Tickets: ${event.ticketUrl}`)
        console.log()
      })
    }

  } catch (error) {
    console.error('💥 Error testing Playwright scraper:', error)
  }
}

testCaveatPlaywrightScraper()
  .then(() => {
    console.log('\n✅ Playwright scraper test completed!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 Test failed:', error)
    process.exit(1)
  })
