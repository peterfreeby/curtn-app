import mongoose, { Schema, Types } from 'mongoose'

// A human-flagged scraper-quality problem on a reviewed import. Distinct from
// rejecting a PendingImport: the row stays in the queue, but the issue is
// logged so we can see which DataSources need a scraper fix. Lives in its own
// collection (not on PendingImport) so the log SURVIVES the wipe+re-stage that
// happens when we fix the scraper. Snapshots title/venue/dataSource so the
// record is still meaningful after the PendingImport is gone.

export const SCRAPER_ISSUE_CATEGORIES = [
  'missing_image',
  'image_hosting_error',
  'missing_description',
  'spam_in_description',
  'missing_cast',
  'missing_date_time',
  'wrong_date_time',
  'missing_ticket_url',
  'wrong_title',
  'not_a_real_event',
  'duplicate',
  'other',
] as const

export type ScraperIssueCategory = (typeof SCRAPER_ISSUE_CATEGORIES)[number]

// The subset of categories that can be marked "verified unavailable" on a
// source — i.e. data that legitimately doesn't exist upstream, not a scraper
// bug. Only "missing_*" fields qualify; wrong_title / spam / duplicate are
// always defects. See DataSource.acceptedGaps and setSourceAcceptedGaps.
export const ACCEPTABLE_GAP_CATEGORIES = [
  'missing_description',
  'missing_image',
  'missing_cast',
  'missing_date_time',
  'missing_ticket_url',
] as const

export type AcceptableGapCategory = (typeof ACCEPTABLE_GAP_CATEGORIES)[number]

export interface IScraperIssue {
  dataSource?: Types.ObjectId
  pendingImport?: Types.ObjectId
  // Snapshots (survive PendingImport deletion)
  title?: string
  venueName?: string
  categories: string[]
  note?: string
  // 'accepted' = closed because the gap was marked verified-unavailable on the
  // source (distinct from 'resolved' = the scraper was actually fixed).
  status: 'open' | 'resolved' | 'accepted'
  createdBy?: Types.ObjectId
  resolvedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const scraperIssueSchema = new Schema<IScraperIssue>(
  {
    dataSource: { type: Schema.Types.ObjectId, ref: 'dataSource', index: true },
    pendingImport: { type: Schema.Types.ObjectId, ref: 'pendingImport' },
    title: { type: String, trim: true },
    venueName: { type: String, trim: true },
    categories: { type: [String], default: [] },
    note: { type: String, trim: true },
    status: { type: String, enum: ['open', 'resolved', 'accepted'], default: 'open', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'user' },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
)

scraperIssueSchema.index({ dataSource: 1, status: 1 })

export const ScraperIssueModel =
  (mongoose.models.scraperIssue as mongoose.Model<IScraperIssue>) ||
  mongoose.model<IScraperIssue>('scraperIssue', scraperIssueSchema)
