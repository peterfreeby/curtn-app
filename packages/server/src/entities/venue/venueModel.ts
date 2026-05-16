import mongoose, { Schema, Types } from 'mongoose'
import { enqueueGeocodingJob } from '../../services/geocoding/enqueueGeocodingJob'
import { claimableFieldsSchema, IClaimableFields } from '../../permissions/claimableFields'
import { PERFORMANCE_TYPES, type PerformanceType } from '../show/showModel'

const ADDRESS_FIELDS = ['address', 'city', 'state', 'zipCode'] as const

export interface IVenue extends IClaimableFields {
  // Basic venue information
  name: string
  slug: string // URL-friendly version of name (e.g., "guthrie-theater")
  description?: string

  // Location data
  address?: string
  city?: string
  state?: string
  zipCode?: string
  coordinates?: {
    lat?: number
    lng?: number
  }

  // Venue details
  capacity?: number
  venueType: 'theater' | 'concert-hall' | 'dance-studio' | 'comedy-club' | 'multi-purpose' | 'outdoor' | 'other'
  // Discipline the venue predominantly programs. Used as a *fallback* for
  // scraped/imported events whose own performance type is missing or
  // unresolvable — never overrides an explicitly-typed event. See
  // [[Venue Default Performance Type]].
  defaultPerformanceType?: PerformanceType

  // Contact and links
  website?: string
  phone?: string
  email?: string

  // Image
  imageUrl?: string

  // Closure status
  permanentlyClosed?: boolean
  closedDate?: Date

  // External references
  wikidataId?: string
  eventbriteVenueId?: string
  googlePlaceId?: string

  // Metadata
  createdAt: Date
  updatedAt: Date
  verificationStatus: 'verified' | 'community'
  submittedBy: Types.ObjectId // User who added this venue
}

const venueSchema = new Schema<IVenue>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  zipCode: {
    type: String,
    trim: true
  },
  coordinates: {
    lat: {
      type: Number,
      min: -90,
      max: 90
    },
    lng: {
      type: Number,
      min: -180,
      max: 180
    }
  },
  capacity: {
    type: Number,
    min: 1
  },
  venueType: {
    type: String,
    enum: ['theater', 'concert-hall', 'dance-studio', 'comedy-club', 'multi-purpose', 'outdoor', 'other'],
    default: 'theater'
  },
  defaultPerformanceType: {
    type: String,
    enum: PERFORMANCE_TYPES
    // optional — left unset for mixed-discipline venues (BAM, REDCAT, 92NY)
  },
  website: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  imageUrl: String,
  permanentlyClosed: {
    type: Boolean,
    default: false
  },
  closedDate: {
    type: Date
  },
  wikidataId: {
    type: String,
    trim: true
  },
  eventbriteVenueId: {
    type: String,
    trim: true
  },
  googlePlaceId: {
    type: String,
    trim: true
  },
  verificationStatus: {
    type: String,
    enum: ['verified', 'community'],
    default: 'verified'
  },
  submittedBy: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  ...claimableFieldsSchema
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
})

// Indexes for efficient querying
venueSchema.index({ name: 'text', description: 'text' }) // Text search
venueSchema.index({ name: 1, _id: 1 }) // cursor pagination
venueSchema.index({ slug: 1 }, { unique: true }) // URL lookups
venueSchema.index({ city: 1 }) // Filter by city
// 2dsphere index intentionally removed: coordinates are stored as `{lat, lng}`,
// which 2dsphere can't project into a spherical CRS — and no code queries by
// geo anyway. Reinstate as a real GeoJSON Point field if/when geo queries are
// actually needed.
venueSchema.index({ venueType: 1 }) // Filter by venue type

// Pre-save middleware to generate slug from name
venueSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
  }
  next()
})

// Geocoding enqueue: address writes trigger a job, the cron worker drains
// the queue at 1 req/sec. Mongoose resets isModified/isNew after save, so
// we stash intent in pre('save') and execute in post('save').
venueSchema.pre('save', function(next) {
  const addressTouched = ADDRESS_FIELDS.some(field => this.isModified(field))
  if (this.isNew || addressTouched) {
    this.$locals.shouldEnqueueGeocoding = true
  }
  next()
})

venueSchema.post('save', async function() {
  if (!this.$locals.shouldEnqueueGeocoding) return
  this.$locals.shouldEnqueueGeocoding = false

  await enqueueGeocodingJob(this._id, {
    address: this.address,
    city: this.city,
    state: this.state,
    zipCode: this.zipCode
  })
})

venueSchema.post('findOneAndUpdate', async function(doc: any) {
  if (!doc) return
  const update = (this.getUpdate() || {}) as Record<string, any>
  const set = (update.$set || update) as Record<string, any>

  const touchesAddress = ADDRESS_FIELDS.some(field => field in set)
  if (!touchesAddress) return

  await enqueueGeocodingJob(doc._id, {
    address: doc.address,
    city: doc.city,
    state: doc.state,
    zipCode: doc.zipCode
  })
})

export const VenueModel = (mongoose.models.venue as mongoose.Model<IVenue>) || mongoose.model<IVenue>('venue', venueSchema)