// packages/server/src/services/scraping/test-integration.ts
import { integrateCaveatData } from './database-integration'
import { PerformanceModel } from '../../entities/performance/performanceModel'
import { VenueModel } from '../../entities/venue/venueModel'
import { UserModel } from '../../entities/user/userModel'
import { connectToDatabase, disconnectFromDatabase } from '../../db/mongoose'
import { genSaltSync, hashSync } from 'bcrypt'

async function testIntegration() {
    try {
      console.log('🚀 TESTING CAVEAT DATABASE INTEGRATION\n')
      
      // Connect to database first
      console.log('🔌 Connecting to database...')
      await connectToDatabase()
      console.log('✅ Database connected!')
  
      // Create a system user for data attribution (if needed)
      let systemUser = await UserModel.findOne({ username: 'system' })
    if (!systemUser) {
      console.log('👤 Creating system user...')
      
      const salt = genSaltSync()
      const hashedPassword = hashSync('temporary-system-password', salt)
      
      systemUser = new UserModel({
        fullName: 'System User',
        email: 'system@stagelog.app',
        username: 'system',
        password: hashedPassword,
        isAdmin: true
      })
      await systemUser.save()
      console.log('✅ System user created')
    }

    // Run the integration
    console.log('🔄 Running integration...\n')
    const result = await integrateCaveatData(systemUser._id.toString())

    // Display results
    console.log('\n📊 INTEGRATION RESULTS:')
    console.log('=======================')
    console.log(`🏢 Venues created: ${result.venuesCreated}`)
    console.log(`🎭 Performances created: ${result.performancesCreated}`)
    console.log(`🔄 Performances updated: ${result.performancesUpdated}`)
    console.log(`❌ Errors: ${result.errors.length}`)

    if (result.errors.length > 0) {
      console.log('\n🚨 ERRORS:')
      result.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`)
      })
    }

    // Verify data in database
    console.log('\n🔍 VERIFYING DATABASE CONTENT:')
    console.log('==============================')
    
    const venueCount = await VenueModel.countDocuments()
    const performanceCount = await PerformanceModel.countDocuments()
    
    console.log(`📍 Total venues in database: ${venueCount}`)
    console.log(`🎪 Total performances in database: ${performanceCount}`)

    // Show sample data
    const caveatVenue = await VenueModel.findOne({ slug: 'caveat-nyc' })
    if (caveatVenue) {
      console.log(`\n🏢 Caveat venue: ${caveatVenue.name}`)
      console.log(`   Address: ${caveatVenue.address}`)
      console.log(`   Coordinates: ${caveatVenue.coordinates.lat}, ${caveatVenue.coordinates.lng}`)
    }

    const recentPerformances = await PerformanceModel.find()
      .populate('venues')
      .sort({ createdAt: -1 })
      .limit(3)

    console.log('\n🎭 RECENT PERFORMANCES:')
    recentPerformances.forEach((perf, i) => {
      console.log(`\n  ${i + 1}. ${perf.title}`)
      console.log(`     Types: ${perf.performanceTypes.join(', ')}`)
      console.log(`     Venue: ${(perf.venues[0] as any)?.name}`)
      if (perf.performances.length > 0) {
        const showing = perf.performances[0]
        console.log(`     Date: ${showing.date.toLocaleDateString()}`)
        console.log(`     Time: ${showing.time}`)
        if (showing.ticketUrl) {
          console.log(`     Tickets: ${showing.ticketUrl}`)
        }
      }
    })

    console.log('\n✅ INTEGRATION TEST COMPLETE!')
    console.log('\n🎯 NEXT STEPS:')
    console.log('1. Test GraphQL queries for the new performance data')
    console.log('2. Update frontend to display performance data')
    console.log('3. Add more venue scrapers')

  } catch (error) {
    console.error('💥 Integration test failed:', error)
  } finally {
    await disconnectFromDatabase()
    process.exit(0)
  }
}

// Run the test
testIntegration()