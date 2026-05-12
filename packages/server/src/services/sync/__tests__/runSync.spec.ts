import { Types } from 'mongoose'
import { UserModel } from '../../../entities/user/userModel'
import { VenueModel } from '../../../entities/venue/venueModel'
import { ShowModel } from '../../../entities/show/showModel'
import { RunModel } from '../../../entities/run/runModel'
import { PerformanceModel } from '../../../entities/performance/performanceModel'
import { StageModel } from '../../../entities/stage/stageModel'
import { DataSourceModel } from '../../../entities/dataSource/dataSourceModel'
import { ProposalModel } from '../../../entities/proposal/proposalModel'
import { AuditLogModel } from '../../../entities/auditLog/auditLogModel'
import { NotificationModel } from '../../../entities/notification/notificationModel'
import { PendingImportModel } from '../../../entities/pendingImport/pendingImportModel'
import { ShadowImportModel } from '../../../entities/shadowImport/shadowImportModel'
import { writeAuditLog } from '../../auditLog/writeAuditLog'
import { stageRowsAsPendingImports } from '../../pendingImport/stage'
import { processSyncHealth } from '../processSyncHealth'

// Mock the feed parser so tests don't make real HTTP calls.
jest.mock('../../feedParser/parseFeed', () => {
  const actual = jest.requireActual('../../feedParser/parseFeed')
  return {
    ...actual,
    parseFeed: jest.fn(),
  }
})

import { parseFeed } from '../../feedParser/parseFeed'
import { runSync } from '../runSync'

const mockedParseFeed = parseFeed as jest.MockedFunction<typeof parseFeed>

describe('Phase 6 — sync executor + stale fallback', () => {
  let claimant: any
  let venue: any
  let dataSource: any

  beforeEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      VenueModel.deleteMany({}),
      ShowModel.deleteMany({}),
      RunModel.deleteMany({}),
      PerformanceModel.deleteMany({}),
      StageModel.deleteMany({}),
      DataSourceModel.deleteMany({}),
      ProposalModel.deleteMany({}),
      AuditLogModel.deleteMany({}),
      NotificationModel.deleteMany({}),
      PendingImportModel.deleteMany({}),
      ShadowImportModel.deleteMany({}),
    ])
    mockedParseFeed.mockReset()

    claimant = await new UserModel({
      firebaseUid: 'sync-c',
      phoneNumber: '+15550009001',
      username: 'syncclaimant',
    }).save()

    // Slug must match slugify(name) so the scraper's name→slug venue lookup
    // (in stage.ts venueIsClaimedSyncedHealthy) resolves to this venue.
    const venueName = `Phase 6 Test Theater ${new Types.ObjectId().toString()}`
    const venueSlug = venueName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    venue = await new VenueModel({
      name: venueName,
      slug: venueSlug,
      venueType: 'theater',
      submittedBy: claimant._id,
      claimedBy: claimant._id,
      claimState: 'claimed-synced',
      syncHealth: 'healthy',
      syncSourceConnectedAt: new Date(),
    }).save()

    dataSource = await new DataSourceModel({
      name: 'Test feed',
      type: 'rss',
      purpose: 'claimant-sync',
      url: 'https://example.com/feed.rss',
      associatedVenue: venue._id,
      cooldownHours: 0.5,
      isActive: true,
      createdBy: claimant._id,
    }).save()
  })

  describe('happy path — new performance', () => {
    it('creates Show/Run/Performance and writes _created AuditLog attributed to SyncFeed', async () => {
      mockedParseFeed.mockResolvedValueOnce([
        {
          title: 'Hamlet',
          description: 'Tragic prince',
          date: new Date('2027-01-15T20:00:00Z'),
          time: '8:00 PM',
          ticketUrl: 'https://example.com/hamlet',
          rawData: { guid: 'h1' },
        },
      ])

      const result = await runSync(dataSource)

      expect(result.errors).toEqual([])
      expect(result.created).toBe(1)
      expect(result.fetched).toBe(1)

      const show = await ShowModel.findOne({ title: 'Hamlet' })
      expect(show).toBeTruthy()
      const perf = await PerformanceModel.findOne({ venueId: venue._id })
      expect(perf).toBeTruthy()
      expect(perf?.ticketUrl).toBe('https://example.com/hamlet')

      const audit = await AuditLogModel.findOne({ 'target.kind': 'Performance', 'target.id': perf!._id })
      expect(audit).toBeTruthy()
      expect(audit?.author.kind).toBe('SyncFeed')
      expect(audit?.author.dataSourceId?.toString()).toBe(dataSource._id.toString())
      expect(audit?.diff._created).toBe(true)
      expect(audit?.approvalSource).toBe('direct-publish')
    })
  })

  describe('conflict routing', () => {
    it('manual edit on a field then sync sees new feed value → creates Proposal, no auto-apply', async () => {
      const eventDate = new Date('2027-02-10T20:00:00Z')

      // First sync creates the performance.
      mockedParseFeed.mockResolvedValueOnce([
        {
          title: 'Macbeth',
          date: eventDate,
          ticketUrl: 'https://example.com/macbeth-old',
          rawData: {},
        },
      ])
      await runSync(dataSource)
      const perf = await PerformanceModel.findOne({ venueId: venue._id })
      expect(perf).toBeTruthy()

      // Claimant manually edits ticketUrl — represented by a User-authored AuditLog row.
      const oldDoc = perf!.toObject()
      perf!.ticketUrl = 'https://example.com/macbeth-claimant-edit'
      await perf!.save()
      await writeAuditLog({
        target: { kind: 'Performance', id: perf!._id },
        author: { kind: 'User', userId: claimant._id, label: 'manual edit' },
        oldDoc,
        newDoc: perf!.toObject(),
        approvalSource: 'direct-publish',
      })

      // Sync fires again with a new feed value for the same performance.
      mockedParseFeed.mockResolvedValueOnce([
        {
          title: 'Macbeth',
          date: eventDate,
          ticketUrl: 'https://example.com/macbeth-feed-new',
          rawData: {},
        },
      ])
      const result = await runSync(dataSource)
      expect(result.queued).toBe(1)
      expect(result.applied).toBe(0)

      // Performance value unchanged (claimant edit holds).
      const after = await PerformanceModel.findById(perf!._id)
      expect(after?.ticketUrl).toBe('https://example.com/macbeth-claimant-edit')

      // A SyncFeed Proposal exists.
      const proposal = await ProposalModel.findOne({ 'target.id': perf!._id, status: 'pending' })
      expect(proposal).toBeTruthy()
      expect(proposal?.proposer.kind).toBe('SyncFeed')
      expect(proposal?.diff.ticketUrl?.new).toBe('https://example.com/macbeth-feed-new')

      // Claimant notified of conflict.
      const notif = await NotificationModel.findOne({
        recipient: claimant._id,
        kind: 'sync_conflict_detected',
      })
      expect(notif).toBeTruthy()
    })

    it('same DataSource re-syncs its own prior value → auto-applies (no conflict)', async () => {
      // First sync sets ticketUrl.
      mockedParseFeed.mockResolvedValueOnce([
        { title: 'Othello', date: new Date('2027-03-01T20:00:00Z'), ticketUrl: 'https://x.com/a', rawData: {} },
      ])
      await runSync(dataSource)

      // Same source sees new value (no conflict, same author).
      mockedParseFeed.mockResolvedValueOnce([
        { title: 'Othello', date: new Date('2027-03-01T20:00:00Z'), ticketUrl: 'https://x.com/b', rawData: {} },
      ])
      const result = await runSync(dataSource)
      expect(result.applied).toBe(1)
      expect(result.queued).toBe(0)
    })
  })

  describe('shadow mode', () => {
    it('scraper-staged rows for a claimed-synced healthy venue write to ShadowImport, not PendingImport', async () => {
      // The venue was set up as claimed-synced healthy in beforeEach.
      // Simulate a scraper run via stageRowsAsPendingImports.
      const result = await stageRowsAsPendingImports(
        [
          {
            title: 'Scraped Show',
            date: '2027-05-01T20:00:00Z',
            venueName: venue.name,
          } as any,
        ],
        { dataSourceId: dataSource._id.toString() },
      )

      expect(result.shadowed).toBe(1)
      expect(result.staged).toBe(0)

      const shadow = await ShadowImportModel.findOne({ title: 'Scraped Show' })
      expect(shadow).toBeTruthy()
      expect(shadow?.purpose).toBe('shadow')

      const pending = await PendingImportModel.findOne({ title: 'Scraped Show' })
      expect(pending).toBeNull()
    })

    it('scraper-staged rows for a claimed-passive venue still write to PendingImport', async () => {
      venue.claimState = 'claimed-passive'
      venue.syncHealth = null
      await venue.save()

      const result = await stageRowsAsPendingImports(
        [
          {
            title: 'Passive Scraped',
            date: '2027-05-02T20:00:00Z',
            venueName: venue.name,
          } as any,
        ],
        { dataSourceId: dataSource._id.toString() },
      )

      expect(result.staged).toBe(1)
      expect(result.shadowed).toBe(0)
    })
  })

  describe('stale + revert + recovery', () => {
    it('3-week silent feed → marks venue stale + fires sync_stale_alert', async () => {
      const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
      dataSource.lastSuccessAt = fourWeeksAgo
      await dataSource.save()

      const result = await processSyncHealth()
      expect(result.staleMarked).toBe(1)

      const v = await VenueModel.findById(venue._id)
      expect(v?.syncHealth).toBe('stale')

      const notif = await NotificationModel.findOne({
        recipient: claimant._id,
        kind: 'sync_stale_alert',
      })
      expect(notif).toBeTruthy()
    })

    it('6-week silent feed → reverts venue to claimed-passive, deactivates DataSource, fires sync_reverted_to_passive', async () => {
      const sevenWeeksAgo = new Date(Date.now() - 49 * 24 * 60 * 60 * 1000)
      dataSource.lastSuccessAt = sevenWeeksAgo
      await dataSource.save()
      venue.syncHealth = 'stale'
      await venue.save()

      const result = await processSyncHealth()
      expect(result.reverted).toBe(1)

      const v = await VenueModel.findById(venue._id)
      expect(v?.claimState).toBe('claimed-passive')
      expect(v?.syncHealth).toBeNull()

      const ds = await DataSourceModel.findById(dataSource._id)
      expect(ds?.isActive).toBe(false)

      const notif = await NotificationModel.findOne({
        recipient: claimant._id,
        kind: 'sync_reverted_to_passive',
      })
      expect(notif).toBeTruthy()
    })

    it('recovery — successful poll after stale flips back to healthy + fires sync_recovered', async () => {
      venue.syncHealth = 'stale'
      await venue.save()

      mockedParseFeed.mockResolvedValueOnce([
        { title: 'Recovery Show', date: new Date('2027-06-01T20:00:00Z'), rawData: {} },
      ])
      await runSync(dataSource)

      const v = await VenueModel.findById(venue._id)
      expect(v?.syncHealth).toBe('healthy')

      const notif = await NotificationModel.findOne({
        recipient: claimant._id,
        kind: 'sync_recovered',
      })
      expect(notif).toBeTruthy()
    })
  })
})
