/**
 * Dev Island Seed Script
 *
 * Creates a set of test shows with realistic UGC patterns for testing features
 * like trending, follow-filtered reviews, analytics, and credits.
 *
 * Shows use long number strings as titles and dates in 418 AD so they're
 * impossible to find organically but render through all real code paths.
 *
 * Usage:
 *   yarn seed:island          — create all dev island data
 *   yarn seed:island --reset  — delete all dev island data
 */

import { faker } from '@faker-js/faker'
import mongoose from 'mongoose'
import { connectToDatabase, disconnectFromDatabase } from '../db/mongoose'
import { UserModel } from '../entities/user/userModel'
import { ShowModel } from '../entities/show/showModel'
import { RunModel } from '../entities/run/runModel'
import { PerformanceModel } from '../entities/performance/performanceModel'
import { ReviewModel } from '../entities/review/reviewModel'
import { VenueModel } from '../entities/venue/venueModel'
import { PersonModel } from '../entities/person/personModel'
import { CreditModel } from '../entities/credit/creditModel'
import { ProductionCompanyModel } from '../entities/productionCompany/productionCompanyModel'
import { FollowModel } from '../entities/follow/followModel'
import { WatchlistItemModel } from '../entities/watchlist/watchlistModel'
import { CommentModel } from '../entities/comment/commentModel'

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

// All dev island entities get tagged with this description prefix so we can
// find and delete them reliably.
const DEV_ISLAND_TAG = '[DEV_ISLAND]'

// Deterministic seed so the island is reproducible
faker.seed(418)

// 418 AD date helpers
function dateIn418(month: number, day: number, hour = 19): Date {
  // JS Date year 418 works fine in MongoDB
  return new Date(418, month - 1, day, hour, 0, 0)
}

// Long number strings for show titles — unmistakable as test data
const SHOW_TITLES = {
  buzzing:      '82749103857291038572',
  polarizing:   '19374628501938746285',
  hiddenGem:    '64820173950648201739',
  longRun:      '37591048263759104826',
  emptyListing: '50382917460503829174',
  creditHeavy:  '91647203851964720385',
}

// Review text snippets that feel realistic
const POSITIVE_REVIEWS = [
  'Absolutely stunning. The ensemble work in the second act was unlike anything I\'ve seen this year.',
  'Went in with zero expectations and left completely floored. Go see this.',
  'The lighting design alone is worth the ticket price. Every transition felt intentional.',
  'I\'ve been thinking about this show for three days straight. It just stays with you.',
  'Finally, something that takes real risks. Not everything lands but when it does — wow.',
  'Brought my friend who never goes to theater and now they want to go every week.',
  'Intimate, raw, and completely committed. This is why I love indie theater.',
  'The writing is so sharp. Every line earns its place.',
]

const NEGATIVE_REVIEWS = [
  'I wanted to like this more than I did. The concept is strong but the execution felt rushed.',
  'Interesting ideas buried under 90 minutes of self-indulgence.',
  'Felt like a first draft that needed three more workshops.',
  'The first 20 minutes had me hooked, then it completely lost the thread.',
  'Not sure what the rave reviews are about. Maybe I saw it on an off night.',
  'Style over substance. Looks great, says nothing.',
]

const MIXED_REVIEWS = [
  'Messy but in a way that feels alive. I kind of loved it?',
  'Some genuinely brilliant moments surrounded by a lot of filler.',
  'The performances carry what the script can\'t quite pull off.',
  'Worth seeing once. Wouldn\'t rush back but glad I went.',
]

function pickReview(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)]
}

// ----------------------------------------------------------------------------
// User creation
// ----------------------------------------------------------------------------

interface DevUser {
  doc: mongoose.Document & { _id: mongoose.Types.ObjectId }
  name: string
}

async function createDevUsers(): Promise<DevUser[]> {
  const userDefs = [
    { name: 'Mara Okonkwo',    username: 'devisle_mara',    bio: 'Theater nerd. Comedy snob. Always in the front row.' },
    { name: 'Jin Alvarez',     username: 'devisle_jin',     bio: 'Director, dramaturge, occasional audience member.' },
    { name: 'Sam Osei',        username: 'devisle_sam',     bio: 'Just here to find something weird to see this weekend.' },
    { name: 'Priya Chen',      username: 'devisle_priya',   bio: 'I review everything. Don\'t take it personally.' },
    { name: 'Nico Petrov',     username: 'devisle_nico',    bio: 'Improv kid turned theater head. Still yes-and-ing.' },
    { name: 'Dayo Williams',   username: 'devisle_dayo',    bio: 'Producer at tiny companies. Big feelings about small shows.' },
    { name: 'Lena Marchetti',  username: 'devisle_lena',    bio: 'Burlesque, cabaret, drag — if it\'s late night, I\'m there.' },
    { name: 'Kwame Durant',    username: 'devisle_kwame',   bio: 'Playwright. Also the guy who always cries at curtain call.' },
    { name: 'Rui Tanaka',      username: 'devisle_rui',     bio: 'Dance background. Judging your blocking silently.' },
    { name: 'Zara Baptiste',   username: 'devisle_zara',    bio: 'New to NYC theater. Trying to see everything.' },
  ]

  const users: DevUser[] = []

  for (const def of userDefs) {
    const existing = await UserModel.findOne({ username: def.username })
    if (existing) {
      console.log(`  User ${def.username} already exists, skipping`)
      users.push({ doc: existing as any, name: def.name })
      continue
    }

    const user = new UserModel({
      firebaseUid: `devisle_${def.username}_${Date.now()}`,
      phoneNumber: `+1555${String(Math.floor(Math.random() * 9000000 + 1000000))}`,
      fullName: def.name,
      username: def.username,
      bio: def.bio,
      isAdmin: false,
    })
    await user.save()
    users.push({ doc: user as any, name: def.name })
    console.log(`  Created user: ${def.name} (@${def.username})`)
  }

  return users
}

// ----------------------------------------------------------------------------
// Follow graph — creates a dense community
// ----------------------------------------------------------------------------

async function createFollowGraph(users: DevUser[]) {
  // Create a realistic follow graph: some users are popular, some follow lots
  const followPairs = [
    // Mara is popular — followed by most people
    [1, 0], [2, 0], [3, 0], [4, 0], [6, 0], [7, 0], [9, 0],
    // Jin and Dayo know each other (industry)
    [1, 5], [5, 1],
    // Priya follows lots of people (active reviewer)
    [3, 0], [3, 1], [3, 2], [3, 4], [3, 5], [3, 6], [3, 7],
    // Some reciprocal follows
    [0, 1], [0, 3], [2, 4], [4, 2], [6, 7], [7, 6],
    // Zara (newbie) follows a few established people
    [9, 0], [9, 1], [9, 3],
    // Kwame and Lena follow each other
    [7, 6], [6, 7],
    // Sam follows some people casually
    [2, 0], [2, 5], [2, 8],
    // Rui follows dance-adjacent people
    [8, 1], [8, 6], [8, 7],
  ]

  let created = 0
  for (const [followerIdx, followingIdx] of followPairs) {
    if (followerIdx === followingIdx) continue
    const follower = users[followerIdx].doc._id
    const following = users[followingIdx].doc._id

    const exists = await FollowModel.findOne({ follower, following })
    if (!exists) {
      await new FollowModel({ follower, following }).save()
      created++
    }
  }
  console.log(`  Created ${created} follow relationships`)
}

// ----------------------------------------------------------------------------
// Venue
// ----------------------------------------------------------------------------

async function getOrCreateVenue(submittedBy: mongoose.Types.ObjectId) {
  const slug = 'dev-island-theatrum-418'
  const existing = await VenueModel.findOne({ slug })
  if (existing) {
    console.log(`  Venue already exists, skipping`)
    return existing
  }

  const venue = new VenueModel({
    name: 'Theatrum CDXVIII',
    slug,
    description: `${DEV_ISLAND_TAG} A venue that has existed since 418 AD. Don't ask questions.`,
    address: '418 Teapot Lane',
    city: 'NYC',
    state: 'NY',
    zipCode: '10002',
    location: { type: 'Point', coordinates: [-73.9868, 40.7185] },
    capacity: 75,
    venueType: 'theater',
    verificationStatus: 'verified',
    submittedBy,
  })
  await venue.save()
  console.log(`  Created venue: Theatrum CDXVIII`)
  return venue
}

// ----------------------------------------------------------------------------
// Production Company
// ----------------------------------------------------------------------------

async function getOrCreateCompany(submittedBy: mongoose.Types.ObjectId) {
  const slug = 'dev-island-productions-418'
  const existing = await ProductionCompanyModel.findOne({ slug })
  if (existing) return existing

  const company = new ProductionCompanyModel({
    name: 'CDXVIII Productions',
    slug,
    description: `${DEV_ISLAND_TAG} Producing shows since the fall of the Western Roman Empire.`,
    submittedBy,
  })
  await company.save()
  console.log(`  Created production company: CDXVIII Productions`)
  return company
}

// ----------------------------------------------------------------------------
// Helper: create a show + run + performances + reviews
// ----------------------------------------------------------------------------

interface ShowScenarioOpts {
  title: string
  description: string
  performanceTypes: string[]
  venueId: mongoose.Types.ObjectId
  companyId: mongoose.Types.ObjectId
  submittedBy: mongoose.Types.ObjectId
  performances: { month: number; day: number; time: string }[]
  reviews: { userIdx: number; perfIdx: number; rating: number; text: string }[]
  watchlistUserIdxs: number[]
  users: DevUser[]
}

async function createShowScenario(opts: ShowScenarioOpts) {
  const { title, description, performanceTypes, venueId, companyId, submittedBy, performances, reviews, watchlistUserIdxs, users } = opts

  // Check if show already exists
  const existingShow = await ShowModel.findOne({ title })
  if (existingShow) {
    console.log(`  Show "${title.slice(0, 12)}..." already exists, skipping`)
    return
  }

  // Show
  const show = new ShowModel({
    title,
    description: `${DEV_ISLAND_TAG} ${description}`,
    performanceTypes,
    duration: 90,
    languages: ['English'],
    verificationStatus: 'verified',
    submittedBy,
  })
  await show.save()

  // Run
  const run = new RunModel({
    show: show._id,
    productionCompany: companyId,
    venues: [venueId],
    startDate: dateIn418(performances[0].month, performances[0].day),
    endDate: dateIn418(performances[performances.length - 1].month, performances[performances.length - 1].day),
    verificationStatus: 'verified',
    submittedBy,
  })
  await run.save()

  // Performances
  const perfDocs: any[] = []
  for (const p of performances) {
    const perf = new PerformanceModel({
      run: run._id,
      date: dateIn418(p.month, p.day),
      time: p.time,
      venueId,
      submittedBy,
    })
    await perf.save()
    perfDocs.push(perf)
  }

  // Reviews
  let reviewCount = 0
  for (const r of reviews) {
    const user = users[r.userIdx].doc
    const perf = perfDocs[r.perfIdx]
    if (!perf) continue

    const review = new ReviewModel({
      user: user._id,
      performance: perf._id,
      run: run._id,
      venue: 'Theatrum CDXVIII',
      text: r.text,
      rating: r.rating,
      attendedAt: perf.date,
    })
    await review.save()
    reviewCount++
  }

  // Watchlist
  let watchlistCount = 0
  for (const idx of watchlistUserIdxs) {
    const user = users[idx].doc
    await new WatchlistItemModel({
      user: user._id,
      show: show._id,
    }).save()
    watchlistCount++
  }

  console.log(`  Created show "${title.slice(0, 12)}..." with ${perfDocs.length} perfs, ${reviewCount} reviews, ${watchlistCount} watchlist`)
  return { show, run, perfDocs }
}

// ----------------------------------------------------------------------------
// Scenario: Buzzing Show — lots of recent reviews, high ratings, high watchlist
// ----------------------------------------------------------------------------

async function seedBuzzingShow(users: DevUser[], venueId: mongoose.Types.ObjectId, companyId: mongoose.Types.ObjectId) {
  console.log('\n  [Buzzing Show]')

  // 8 performances over 2 weeks, lots of reviews
  const performances = [
    { month: 3, day: 1, time: '7:30 PM' },
    { month: 3, day: 2, time: '7:30 PM' },
    { month: 3, day: 5, time: '8:00 PM' },
    { month: 3, day: 8, time: '7:30 PM' },
    { month: 3, day: 9, time: '2:00 PM' },
    { month: 3, day: 9, time: '7:30 PM' },
    { month: 3, day: 12, time: '8:00 PM' },
    { month: 3, day: 14, time: '7:30 PM' },
  ]

  // Most people loved it — high ratings, lots of reviews
  const reviews = [
    { userIdx: 0, perfIdx: 0, rating: 5, text: pickReview(POSITIVE_REVIEWS) },
    { userIdx: 1, perfIdx: 0, rating: 4.5, text: pickReview(POSITIVE_REVIEWS) },
    { userIdx: 2, perfIdx: 1, rating: 4, text: pickReview(POSITIVE_REVIEWS) },
    { userIdx: 3, perfIdx: 2, rating: 5, text: pickReview(POSITIVE_REVIEWS) },
    { userIdx: 4, perfIdx: 3, rating: 4.5, text: pickReview(POSITIVE_REVIEWS) },
    { userIdx: 5, perfIdx: 4, rating: 5, text: pickReview(POSITIVE_REVIEWS) },
    { userIdx: 6, perfIdx: 5, rating: 4, text: pickReview(MIXED_REVIEWS) },
    { userIdx: 7, perfIdx: 6, rating: 5, text: pickReview(POSITIVE_REVIEWS) },
    { userIdx: 8, perfIdx: 6, rating: 4.5, text: pickReview(POSITIVE_REVIEWS) },
    { userIdx: 9, perfIdx: 7, rating: 5, text: pickReview(POSITIVE_REVIEWS) },
  ]

  // Almost everyone watchlisted it
  const watchlistUserIdxs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

  await createShowScenario({
    title: SHOW_TITLES.buzzing,
    description: 'SCENARIO: Buzzing Show — high ratings, lots of reviews, high watchlist count. Tests trending surfaces and buzz ranking.',
    performanceTypes: ['experimental', 'theater'],
    venueId, companyId,
    submittedBy: users[0].doc._id,
    performances, reviews, watchlistUserIdxs, users,
  })
}

// ----------------------------------------------------------------------------
// Scenario: Polarizing Show — bimodal ratings (1s and 5s)
// ----------------------------------------------------------------------------

async function seedPolarizingShow(users: DevUser[], venueId: mongoose.Types.ObjectId, companyId: mongoose.Types.ObjectId) {
  console.log('\n  [Polarizing Show]')

  const performances = [
    { month: 4, day: 1, time: '8:00 PM' },
    { month: 4, day: 3, time: '8:00 PM' },
    { month: 4, day: 5, time: '8:00 PM' },
    { month: 4, day: 7, time: '7:30 PM' },
    { month: 4, day: 8, time: '2:00 PM' },
    { month: 4, day: 8, time: '8:00 PM' },
  ]

  // Bimodal: people either love it or hate it
  const reviews = [
    { userIdx: 0, perfIdx: 0, rating: 5, text: pickReview(POSITIVE_REVIEWS) },
    { userIdx: 1, perfIdx: 0, rating: 1, text: pickReview(NEGATIVE_REVIEWS) },
    { userIdx: 2, perfIdx: 1, rating: 5, text: pickReview(POSITIVE_REVIEWS) },
    { userIdx: 3, perfIdx: 1, rating: 1.5, text: pickReview(NEGATIVE_REVIEWS) },
    { userIdx: 4, perfIdx: 2, rating: 4.5, text: pickReview(POSITIVE_REVIEWS) },
    { userIdx: 5, perfIdx: 3, rating: 1, text: pickReview(NEGATIVE_REVIEWS) },
    { userIdx: 6, perfIdx: 4, rating: 5, text: pickReview(POSITIVE_REVIEWS) },
    { userIdx: 7, perfIdx: 4, rating: 1.5, text: pickReview(NEGATIVE_REVIEWS) },
    { userIdx: 8, perfIdx: 5, rating: 4.5, text: 'I get why people hate this but I think they\'re wrong. This is exactly the kind of risk theater should be taking.' },
    { userIdx: 9, perfIdx: 5, rating: 2, text: 'Everyone in my row walked out at intermission. I stayed. Not sure why.' },
  ]

  const watchlistUserIdxs = [0, 2, 4, 6, 8]

  await createShowScenario({
    title: SHOW_TITLES.polarizing,
    description: 'SCENARIO: Polarizing Show — bimodal ratings (1s and 5s), lots of discourse. Tests rating distribution charts and review sorting.',
    performanceTypes: ['experimental', 'immersive'],
    venueId, companyId,
    submittedBy: users[1].doc._id,
    performances, reviews, watchlistUserIdxs, users,
  })
}

// ----------------------------------------------------------------------------
// Scenario: Hidden Gem — few reviews, all high
// ----------------------------------------------------------------------------

async function seedHiddenGem(users: DevUser[], venueId: mongoose.Types.ObjectId, companyId: mongoose.Types.ObjectId) {
  console.log('\n  [Hidden Gem]')

  const performances = [
    { month: 5, day: 10, time: '9:00 PM' },
    { month: 5, day: 11, time: '9:00 PM' },
  ]

  // Only 3 reviews, but all glowing
  const reviews = [
    { userIdx: 0, perfIdx: 0, rating: 5, text: 'I cannot believe more people haven\'t seen this. One of the best things I\'ve seen all year and nobody\'s talking about it.' },
    { userIdx: 3, perfIdx: 0, rating: 4.5, text: 'Tiny show, huge heart. The kind of thing you only find if someone drags you to it.' },
    { userIdx: 7, perfIdx: 1, rating: 5, text: pickReview(POSITIVE_REVIEWS) },
  ]

  const watchlistUserIdxs = [0, 3]

  await createShowScenario({
    title: SHOW_TITLES.hiddenGem,
    description: 'SCENARIO: Hidden Gem — 3 reviews, all 4.5-5 stars, low watchlist. Tests recommendation logic and "underrated" surfaces.',
    performanceTypes: ['spoken-word', 'experimental'],
    venueId, companyId,
    submittedBy: users[7].doc._id,
    performances, reviews, watchlistUserIdxs, users,
  })
}

// ----------------------------------------------------------------------------
// Scenario: Long Run — reviews spread over months, declining velocity
// ----------------------------------------------------------------------------

async function seedLongRun(users: DevUser[], venueId: mongoose.Types.ObjectId, companyId: mongoose.Types.ObjectId) {
  console.log('\n  [Long Run]')

  // Performances spread across 3 months
  const performances = [
    { month: 1, day: 10, time: '7:30 PM' },
    { month: 1, day: 17, time: '7:30 PM' },
    { month: 1, day: 24, time: '7:30 PM' },
    { month: 2, day: 7, time: '7:30 PM' },
    { month: 2, day: 14, time: '7:30 PM' },
    { month: 2, day: 21, time: '7:30 PM' },
    { month: 3, day: 7, time: '7:30 PM' },
    { month: 3, day: 14, time: '7:30 PM' },
    { month: 3, day: 21, time: '7:30 PM' },
    { month: 3, day: 28, time: '7:30 PM' },
  ]

  // Reviews taper off: 4 in month 1, 2 in month 2, 1 in month 3
  const reviews = [
    { userIdx: 0, perfIdx: 0, rating: 4.5, text: pickReview(POSITIVE_REVIEWS) },
    { userIdx: 1, perfIdx: 0, rating: 4, text: pickReview(POSITIVE_REVIEWS) },
    { userIdx: 3, perfIdx: 1, rating: 4, text: pickReview(MIXED_REVIEWS) },
    { userIdx: 4, perfIdx: 2, rating: 3.5, text: pickReview(MIXED_REVIEWS) },
    { userIdx: 5, perfIdx: 3, rating: 3.5, text: 'Still solid but losing a bit of the energy from opening week.' },
    { userIdx: 6, perfIdx: 4, rating: 4, text: pickReview(POSITIVE_REVIEWS) },
    { userIdx: 9, perfIdx: 7, rating: 3, text: 'Caught this near the end of the run. You can tell the cast is tired but the bones are good.' },
  ]

  const watchlistUserIdxs = [0, 1, 2, 5, 7]

  await createShowScenario({
    title: SHOW_TITLES.longRun,
    description: 'SCENARIO: Long Run — reviews spread over 3 months with declining velocity. Tests reception analytics, sentiment over time.',
    performanceTypes: ['play', 'theater'],
    venueId, companyId,
    submittedBy: users[5].doc._id,
    performances, reviews, watchlistUserIdxs, users,
  })
}

// ----------------------------------------------------------------------------
// Scenario: Empty Listing — show exists with runs but zero reviews
// ----------------------------------------------------------------------------

async function seedEmptyListing(users: DevUser[], venueId: mongoose.Types.ObjectId, companyId: mongoose.Types.ObjectId) {
  console.log('\n  [Empty Listing]')

  const performances = [
    { month: 6, day: 1, time: '8:00 PM' },
    { month: 6, day: 2, time: '8:00 PM' },
    { month: 6, day: 3, time: '8:00 PM' },
  ]

  await createShowScenario({
    title: SHOW_TITLES.emptyListing,
    description: 'SCENARIO: Empty Listing — show with runs and performances but zero reviews. Tests cold start states and empty UI.',
    performanceTypes: ['comedy', 'improv'],
    venueId, companyId,
    submittedBy: users[2].doc._id,
    performances,
    reviews: [],
    watchlistUserIdxs: [2],
    users,
  })
}

// ----------------------------------------------------------------------------
// Scenario: Credit-Heavy Production — lots of cast/crew credits
// ----------------------------------------------------------------------------

async function seedCreditHeavy(users: DevUser[], venueId: mongoose.Types.ObjectId, companyId: mongoose.Types.ObjectId) {
  console.log('\n  [Credit-Heavy Production]')

  const existingShow = await ShowModel.findOne({ title: SHOW_TITLES.creditHeavy })
  if (existingShow) {
    console.log(`  Show "${SHOW_TITLES.creditHeavy.slice(0, 12)}..." already exists, skipping`)
    return
  }

  const submittedBy = users[1].doc._id

  // Show
  const show = new ShowModel({
    title: SHOW_TITLES.creditHeavy,
    description: `${DEV_ISLAND_TAG} SCENARIO: Credit-Heavy Production — many cast/crew. Tests credits on profile, "find director's other work."`,
    performanceTypes: ['musical', 'theater'],
    duration: 120,
    languages: ['English'],
    verificationStatus: 'verified',
    submittedBy,
  })
  await show.save()

  // Run
  const run = new RunModel({
    show: show._id,
    productionCompany: companyId,
    venues: [venueId],
    startDate: dateIn418(7, 1),
    endDate: dateIn418(7, 15),
    verificationStatus: 'verified',
    submittedBy,
  })
  await run.save()

  // Performances
  const perfDates = [
    { month: 7, day: 1, time: '7:30 PM' },
    { month: 7, day: 5, time: '7:30 PM' },
    { month: 7, day: 10, time: '7:30 PM' },
    { month: 7, day: 15, time: '2:00 PM' },
  ]
  const perfDocs: any[] = []
  for (const p of perfDates) {
    const perf = new PerformanceModel({
      run: run._id,
      date: dateIn418(p.month, p.day),
      time: p.time,
      venueId,
      submittedBy,
    })
    await perf.save()
    perfDocs.push(perf)
  }

  // Create People (cast & crew)
  const castCrew = [
    { name: 'Amara Diallo',     role: 'Lead — Helena',    type: 'cast' as const, order: 0 },
    { name: 'Theo Nakamura',    role: 'Lead — Lysander',  type: 'cast' as const, order: 1 },
    { name: 'Celia Ramirez',    role: 'Titania',          type: 'cast' as const, order: 2 },
    { name: 'Idris Cole',       role: 'Oberon',           type: 'cast' as const, order: 3 },
    { name: 'Yuki Brennan',     role: 'Puck',             type: 'cast' as const, order: 4 },
    { name: 'Soren Achebe',     role: 'Director',         type: 'crew' as const, order: 0 },
    { name: 'Margot Liu',       role: 'Choreographer',    type: 'crew' as const, order: 1 },
    { name: 'Felix Okonjo',     role: 'Lighting Design',  type: 'crew' as const, order: 2 },
    { name: 'Anya Petrossian',  role: 'Sound Design',     type: 'crew' as const, order: 3 },
    { name: 'River Caldwell',   role: 'Stage Manager',    type: 'crew' as const, order: 4 },
  ]

  let creditCount = 0
  for (const cc of castCrew) {
    const slug = cc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    const devSlug = `devisle-${slug}`

    let person = await PersonModel.findOne({ slug: devSlug })
    if (!person) {
      person = new PersonModel({
        name: cc.name,
        slug: devSlug,
        bio: `${DEV_ISLAND_TAG} ${cc.type === 'cast' ? 'Actor' : cc.role} based in NYC.`,
        submittedBy,
      })
      // Unset userId to avoid sparse unique index conflict on null values
      person.set('userId', undefined)
      await person.save()
    }

    const existingCredit = await CreditModel.findOne({ person: person._id, run: run._id, role: cc.role })
    if (!existingCredit) {
      await new CreditModel({
        person: person._id,
        run: run._id,
        creditType: cc.type,
        role: cc.role,
        order: cc.order,
        submittedBy,
      }).save()
      creditCount++
    }
  }

  // Some reviews on this show too
  const reviewDefs = [
    { userIdx: 0, perfIdx: 0, rating: 4.5, text: 'The cast is incredible. Amara Diallo is a revelation.' },
    { userIdx: 3, perfIdx: 1, rating: 4, text: 'Soren Achebe really knows how to use that space. The lighting in act 2 is gorgeous.' },
    { userIdx: 6, perfIdx: 2, rating: 5, text: 'Best ensemble I\'ve seen this year. Every single person on that stage is giving everything.' },
    { userIdx: 8, perfIdx: 3, rating: 4, text: 'The choreography elevates what could have been a pretty standard revival. Margot Liu deserves all the credit.' },
  ]

  for (const r of reviewDefs) {
    await new ReviewModel({
      user: users[r.userIdx].doc._id,
      performance: perfDocs[r.perfIdx]._id,
      run: run._id,
      venue: 'Theatrum CDXVIII',
      text: r.text,
      rating: r.rating,
      attendedAt: perfDocs[r.perfIdx].date,
    }).save()
  }

  // Watchlist
  for (const idx of [0, 1, 3, 6, 8]) {
    await new WatchlistItemModel({
      user: users[idx].doc._id,
      show: show._id,
    }).save()
  }

  console.log(`  Created show with ${creditCount} credits, ${perfDocs.length} perfs, ${reviewDefs.length} reviews`)
}

// ----------------------------------------------------------------------------
// Reset: delete all dev island data
// ----------------------------------------------------------------------------

async function resetDevIsland() {
  console.log('\nResetting dev island...\n')

  // Find dev island users by username prefix
  const devUsers = await UserModel.find({ username: /^devisle_/ })
  const devUserIds = devUsers.map(u => u._id)

  // Find dev island shows by their number-string titles
  const devShowTitles = Object.values(SHOW_TITLES)
  const devShows = await ShowModel.find({ title: { $in: devShowTitles } })
  const devShowIds = devShows.map(s => s._id)

  // Find runs for those shows
  const devRuns = await RunModel.find({ show: { $in: devShowIds } })
  const devRunIds = devRuns.map(r => r._id)

  // Find performances for those runs
  const devPerfs = await PerformanceModel.find({ run: { $in: devRunIds } })
  const devPerfIds = devPerfs.map(p => p._id)

  // Find dev island persons by slug prefix
  const devPersons = await PersonModel.find({ slug: /^devisle-/ })
  const devPersonIds = devPersons.map(p => p._id)

  // Delete in dependency order
  const results = await Promise.all([
    ReviewModel.deleteMany({ performance: { $in: devPerfIds } }),
    CreditModel.deleteMany({ person: { $in: devPersonIds } }),
    WatchlistItemModel.deleteMany({ show: { $in: devShowIds } }),
    FollowModel.deleteMany({ $or: [{ follower: { $in: devUserIds } }, { following: { $in: devUserIds } }] }),
  ])
  console.log(`  Deleted ${results[0].deletedCount} reviews`)
  console.log(`  Deleted ${results[1].deletedCount} credits`)
  console.log(`  Deleted ${results[2].deletedCount} watchlist items`)
  console.log(`  Deleted ${results[3].deletedCount} follows`)

  const results2 = await Promise.all([
    PerformanceModel.deleteMany({ run: { $in: devRunIds } }),
    PersonModel.deleteMany({ slug: /^devisle-/ }),
  ])
  console.log(`  Deleted ${results2[0].deletedCount} performances`)
  console.log(`  Deleted ${results2[1].deletedCount} persons`)

  const results3 = await Promise.all([
    RunModel.deleteMany({ show: { $in: devShowIds } }),
  ])
  console.log(`  Deleted ${results3[0].deletedCount} runs`)

  const results4 = await Promise.all([
    ShowModel.deleteMany({ title: { $in: devShowTitles } }),
    VenueModel.deleteMany({ slug: 'dev-island-theatrum-418' }),
    ProductionCompanyModel.deleteMany({ slug: 'dev-island-productions-418' }),
    UserModel.deleteMany({ username: /^devisle_/ }),
  ])
  console.log(`  Deleted ${results4[0].deletedCount} shows`)
  console.log(`  Deleted ${results4[1].deletedCount} venues`)
  console.log(`  Deleted ${results4[2].deletedCount} production companies`)
  console.log(`  Deleted ${results4[3].deletedCount} users`)

  console.log('\nDev island reset complete.')
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function main() {
  await connectToDatabase()

  const isReset = process.argv.includes('--reset')

  if (isReset) {
    await resetDevIsland()
  } else {
    console.log('\nSeeding dev island...\n')

    // Users
    console.log('Creating users...')
    const users = await createDevUsers()

    // Follow graph
    console.log('\nCreating follow graph...')
    await createFollowGraph(users)

    // Venue + Company
    console.log('\nCreating venue & company...')
    const venue = await getOrCreateVenue(users[0].doc._id)
    const company = await getOrCreateCompany(users[0].doc._id)

    // Scenarios
    console.log('\nCreating scenarios...')
    await seedBuzzingShow(users, venue._id, company._id)
    await seedPolarizingShow(users, venue._id, company._id)
    await seedHiddenGem(users, venue._id, company._id)
    await seedLongRun(users, venue._id, company._id)
    await seedEmptyListing(users, venue._id, company._id)
    await seedCreditHeavy(users, venue._id, company._id)

    console.log('\nDev island seeded successfully!')
    console.log('Shows use number-string titles and 418 AD dates.')
    console.log('Run with --reset to remove all dev island data.\n')
  }

  await disconnectFromDatabase()
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error seeding dev island:', err)
    process.exit(1)
  })
