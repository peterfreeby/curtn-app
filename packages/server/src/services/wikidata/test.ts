import { WikidataAPI } from './api'

async function testWikidataQueries() {
  console.log('🌍 TESTING WIKIDATA API INTEGRATION\n')

  try {
    // Test 1: Search for Hamilton
    console.log('🎭 SEARCHING FOR "HAMILTON" PERFORMANCES...')
    const hamiltonResults = await WikidataAPI.searchTheatricalPerformances('Hamilton', 5)
    console.log(`Found ${hamiltonResults.length} Hamilton-related performances:`)
    hamiltonResults.forEach((perf, i) => {
      console.log(`  ${i + 1}. ${perf.itemLabel}`)
      if (perf.venueLabel) console.log(`     Venue: ${perf.venueLabel}`)
      if (perf.premiereDate) console.log(`     Premiere: ${perf.premiereDate}`)
      if (perf.directorLabel) console.log(`     Director: ${perf.directorLabel}`)
      console.log()
    })

    // Test 2: Search for venues in NYC
    console.log('\n🏢 SEARCHING FOR NYC VENUES...')
    const nycVenues = await WikidataAPI.searchVenuesInCity('NYC', 10)
    console.log(`Found ${nycVenues.length} venues in NYC:`)
    nycVenues.forEach((venue, i) => {
      console.log(`  ${i + 1}. ${venue.venueLabel}`)
      if (venue.address) console.log(`     Address: ${venue.address}`)
      if (venue.capacity) console.log(`     Capacity: ${venue.capacity}`)
      if (venue.venueType) console.log(`     Type: ${venue.venueType}`)
      console.log()
    })

    // Test 3: Search for Shakespeare performances
    console.log('\n🎪 SEARCHING FOR "SHAKESPEARE" PERFORMANCES...')
    const shakespeareResults = await WikidataAPI.searchTheatricalPerformances('Shakespeare', 5)
    console.log(`Found ${shakespeareResults.length} Shakespeare performances:`)
    shakespeareResults.forEach((perf, i) => {
      console.log(`  ${i + 1}. ${perf.itemLabel}`)
      if (perf.performanceTypeLabel) console.log(`     Type: ${perf.performanceTypeLabel}`)
      if (perf.companyLabel) console.log(`     Company: ${perf.companyLabel}`)
      console.log()
    })

    // Test 4: Search venues in Minneapolis
    console.log('\n🎭 SEARCHING FOR MINNEAPOLIS VENUES...')
    const minneapolisVenues = await WikidataAPI.searchVenuesInCity('Minneapolis', 5)
    console.log(`Found ${minneapolisVenues.length} venues in Minneapolis:`)
    minneapolisVenues.forEach((venue, i) => {
      console.log(`  ${i + 1}. ${venue.venueLabel}`)
      if (venue.coordinates) console.log(`     Coordinates: ${venue.coordinates}`)
      if (venue.website) console.log(`     Website: ${venue.website}`)
      console.log()
    })

  } catch (error) {
    console.error('❌ Error testing Wikidata API:', error)
  }
}

// Run the test
testWikidataQueries()
  .then(() => {
    console.log('✅ Wikidata API test completed!')
    process.exit(0)
  })
  .catch(error => {
    console.error('💥 Test failed:', error)
    process.exit(1)
  })