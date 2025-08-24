import { CaveatScraperV2 } from './caveat-scraper-playwright-v2'

async function testImprovedCaveatScraper() {
  console.log('🎭 TESTING IMPROVED CAVEAT SCRAPER')
  console.log('==================================\n')

  try {
    const events = await CaveatScraperV2.scrapeEvents()

    if (events.length === 0) {
      console.log('❌ No events found')
    } else {
      console.log(`\n✅ FINAL RESULTS: ${events.length} clean events found:\n`)
      
      events.forEach((event, index) => {
        console.log(`${index + 1}. 🎭 ${event.title}`)
        console.log(`   📅 ${event.date} at ${event.time}`)
        if (event.description) {
          console.log(`   📝 ${event.description}`)
        }
        if (event.ticketUrl) {
          console.log(`   🎫 ${event.ticketUrl}`)
        }
        console.log(`   🏢 ${event.venue}`)
        console.log(`   🎪 ${event.eventType}`)
        if (event.soldOut) {
          console.log(`   ❌ SOLD OUT`)
        }
        console.log()
      })
      
      console.log('🎯 QUALITY CHECK:')
      console.log('=================')
      console.log(`✅ Events have clean titles: ${events.every(e => e.title && e.title.length > 3)}`)
      console.log(`✅ Events have dates: ${events.every(e => e.date)}`)
      console.log(`✅ Events have times: ${events.every(e => e.time)}`)
      console.log(`✅ Events have ticket URLs: ${events.filter(e => e.ticketUrl).length}/${events.length}`)
      console.log(`✅ Contains Eventbrite links: ${events.some(e => e.ticketUrl?.includes('eventbrite'))}`)
    }

  } catch (error) {
    console.error('💥 Error:', error)
  }
}

testImprovedCaveatScraper()
  .then(() => {
    console.log('\n✅ Improved scraper test completed!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 Test failed:', error)
    process.exit(1)
  })