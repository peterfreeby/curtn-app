import mongoose, { Schema, Types } from 'mongoose'

export interface IPerformance {
  // Basic information
  title: string
  description: string
  performanceTypes: string[] // Multiple tags: 'theater', 'musical', 'dance', 'comedy', 'improv', 'spoken-word', 'cabaret', 'experimental', 'immersive', 'drag', 'burlesque', 'happening', 'other'
  
  // Duration and format
  duration: number // duration in minutes
  intermissions: number
  languages: string[],
  
  // Venue references
  venues: Types.ObjectId[] // References to Venue documents
  
  // Company/Troupe information
  company: {
    name: string
    description?: string
    wikidataId?: string
  }
  
  // Performance schedule
  performances: {
    date: Date
    time: string
    venueId: Types.ObjectId // Reference to specific venue
    ticketUrl?: string
    eventbriteId?: string
    soldOut?: boolean
  }[]
  
  // External API references
  wikidataId?: string
  eventbriteId?: string
  
  // Metadata
  createdAt: Date
  updatedAt: Date
  submittedBy: Types.ObjectId // reference to user who added this performance
}

const performanceSchema = new Schema<IPerformance>({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  performanceTypes: [{
    type: String,
    enum: ['theater', 'musical', 'dance', 'comedy', 'improv', 'spoken-word', 'cabaret', 'experimental', 'immersive', 'drag', 'burlesque', 'happening', 'other'],
    required: true
  }],
  duration: {
    type: Number,
    required: true,
    min: 1
  },
  intermissions: {
    type: Number,
    default: 0,
    min: 0
  },
  languages: [{  // Rename to avoid MongoDB conflict
    type: String,
    default: ['English']
  }],
  venues: [{
    type: Schema.Types.ObjectId,
    ref: 'venue',
    required: true
  }],
  company: {
    name: {
      type: String,
      required: true
    },
    description: String,
    wikidataId: String
  },
  performances: [{
    date: {
      type: Date,
      required: true
    },
    time: {
      type: String,
      required: true
    },
    venueId: {
      type: Schema.Types.ObjectId,
      ref: 'venue',
      required: true
    },
    ticketUrl: String,
    eventbriteId: String,
    soldOut: {
      type: Boolean,
      default: false
    }
  }],
  wikidataId: String,
  eventbriteId: String,
  submittedBy: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  }
}, {
  timestamps: true // This automatically adds createdAt and updatedAt
})

// Create indexes for searching and filtering
performanceSchema.index({ title: 'text', description: 'text' })
performanceSchema.index({ performanceTypes: 1 }) // For filtering by type
performanceSchema.index({ 'performances.date': 1 }) // For date-based queries
performanceSchema.index({ 'venues': 1 }) // For venue-based queries
performanceSchema.index({ 'performances.venueId': 1 }) // For performance venue lookups

export const PerformanceModel = mongoose.model<IPerformance>('performance', performanceSchema)