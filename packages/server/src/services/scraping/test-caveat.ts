import { CaveatScraper } from './caveat-scraper'

async function testCaveatScraper() {
  console.log('🎭 TESTING CAVEAT NYC SCRAPER')
  console.log('=============================\n')

  try {
    // First, debug the page structure to understand what we're working with
    console.log('🔍 Step 1: Analyzing Caveat website structure...\n')
    await CaveatScraper.debugStructure()

    console.log('\n' + '='.repeat(50) + '\n')

    // Then try to scrape actual events
    console.log('🎫 Step 2: Scraping events...\n')
    const events = await CaveatScraper.scrapeEvents()

    if (events.length === 0) {
      console.log('❌ No events found. The page structure might be different than expected.')
      console.log('💡 Check the debug output above to see what HTML structure is actually on the page.')
    } else {
      console.log(`✅ Successfully scraped ${events.length} events from Caveat:\n`)
      
      events.forEach((event, index) => {
        console.log(`${index + 1}. ${event.title}`)
        if (event.date) console.log(`   📅 Date: ${event.date}`)
        if (event.price) console.log(`   💰 Price: ${event.price}`)
        if (event.description) console.log(`   📝 Description: ${event.description.substring(0, 100)}${event.description.length > 100 ? '...' : ''}`)
        if (event.ticketUrl) console.log(`   🎫 Tickets: ${event.ticketUrl}`)
        if (event.soldOut) console.log(`   🚫 SOLD OUT`)
        console.log()
      })
    }

    // Quality assessment questions for you
    console.log('🎯 QUALITY ASSESSMENT:')
    console.log('======================')
    console.log('Since you go to Caveat frequently, please check:')
    console.log('1. Do these events match what you see on caveat.nyc?')
    console.log('2. Are the dates/times accurate?')
    console.log('3. Are there events missing that you know are happening?')
    console.log('4. Are the ticket links working?')
    console.log('5. Does the event information look complete?')

  } catch (error) {
    console.error('💥 Error testing Caveat scraper:', error)
  }
}

// Run the test
testCaveatScraper()
  .then(() => {
    console.log('\n✅ Caveat scraper test completed!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 Test failed:', error)
    process.exit(1)
  })