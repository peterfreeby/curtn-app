const Router = require('koa-router');
const PerformanceModel = require('./entities/performance/PerformanceModel');
const VenueModel = require('./entities/venue/VenueModel');

const router = new Router();

// REST endpoint for Figma Data Sync
router.get('/api/performances', async (ctx) => {
  try {
    const performances = await PerformanceModel.find()
      .populate('venues')
      .limit(20)
      .sort({ createdAt: -1 });
    
    // Transform to simple JSON structure for Figma
    const figmaData = performances.map(perf => ({
      id: perf._id.toString(),
      title: perf.title,
      types: perf.performanceTypes ? perf.performanceTypes.join(', ') : 'performance',
      venue: perf.venues && perf.venues[0] ? perf.venues[0].name : 'TBD',
      city: perf.venues && perf.venues[0] ? perf.venues[0].city : 'NYC',
      description: perf.description || 'Performance description...',
      company: perf.company || 'Various Artists'
    }));
    
    ctx.body = figmaData;
  } catch (error) {
    console.error('API Error:', error);
    ctx.status = 500;
    ctx.body = { error: 'Failed to fetch performances' };
  }
});

// Also add venues endpoint
router.get('/api/venues', async (ctx) => {
  try {
    const venues = await VenueModel.find().limit(10);
    
    const figmaData = venues.map(venue => ({
      id: venue._id.toString(),
      name: venue.name,
      city: venue.city,
      address: venue.address,
      type: venue.venueType || 'theater',
      capacity: venue.capacity || 'intimate'
    }));
    
    ctx.body = figmaData;
  } catch (error) {
    console.error('Venues API Error:', error);
    ctx.status = 500;
    ctx.body = { error: 'Failed to fetch venues' };
  }
});

module.exports = router;
