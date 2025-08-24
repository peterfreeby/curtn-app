import mongoose, { Schema, Types } from 'mongoose'

export interface IVenue {
  // Basic venue information
  name: string
  slug: string // URL-friendly version of name (e.g., "guthrie-theater")
  description?: string
  
  // Location data
  address: string
  city: string // NYC, Minneapolis, LA
  state: string // NY, MN, CA
  zipCode?: string
  coordinates: {
    lat: number
    lng: number
  }
  
  // Venue details
  capacity?: number
  venueType: 'theater' | 'concert-hall' | 'dance-studio' | 'comedy-club' | 'multi-purpose' | 'outdoor' | 'other'
  
  // Contact and links
  website?: string
  phone?: string
  email?: string
  
  // External references
  eventbriteVenueId?: string
  googlePlaceId?: string
  
  // Metadata
  createdAt: Date
  updatedAt: Date
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
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    enum: ['NYC', 'Minneapolis', 'LA'], // Your three target cities
    trim: true
  },
  state: {
    type: String,
    required: true,
    enum: ['NY', 'MN', 'CA'],
    trim: true
  },
  zipCode: {
    type: String,
    trim: true
  },
  coordinates: {
    lat: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    lng: {
      type: Number,
      required: true,
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
  eventbriteVenueId: {
    type: String,
    trim: true
  },
  googlePlaceId: {
    type: String,
    trim: true
  },
  submittedBy: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
})

// Indexes for efficient querying
venueSchema.index({ name: 'text', description: 'text' }) // Text search
venueSchema.index({ slug: 1 }, { unique: true }) // URL lookups
venueSchema.index({ city: 1 }) // Filter by city
venueSchema.index({ coordinates: '2dsphere' }) // Geospatial queries
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

export const VenueModel = mongoose.model<IVenue>('venue', venueSchema)