import { GeocodingJobModel, IGeocodingJob } from '../../entities/geocodingJob/geocodingJobModel'
import { VenueModel } from '../../entities/venue/venueModel'
import { geocodeViaNominatim } from './nominatim'

const THROTTLE_MS = 1100           // Nominatim: max 1 req/sec; 1.1s for headroom
const MAX_ATTEMPTS = 5
const MAX_BATCH = 10
const DEFAULT_TIME_BUDGET_MS = 8000 // stay under Vercel Hobby 10s function limit

// Exponential backoff schedule (in ms). Index = attemptCount after failure.
const BACKOFF_SCHEDULE_MS = [
  60_000,       // 1 min
  5 * 60_000,   // 5 min
  30 * 60_000,  // 30 min
  2 * 60 * 60_000,   // 2 hr
  12 * 60 * 60_000   // 12 hr
]

function backoffDelay(attemptCount: number): number {
  return BACKOFF_SCHEDULE_MS[Math.min(attemptCount, BACKOFF_SCHEDULE_MS.length - 1)]
}

function composeAddress(snapshot: IGeocodingJob['addressSnapshot']): string {
  return [snapshot.address, snapshot.city, snapshot.state, snapshot.zipCode]
    .map(part => part?.trim())
    .filter((part): part is string => !!part)
    .join(', ')
}

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

export interface ProcessResult {
  processed: number
  succeeded: number
  failed: number
  retryScheduled: number
  timedOut: boolean
}

export async function processGeocodingJobs(
  timeBudgetMs: number = DEFAULT_TIME_BUDGET_MS
): Promise<ProcessResult> {
  const startedAt = Date.now()
  const deadline = startedAt + timeBudgetMs

  const result: ProcessResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    retryScheduled: 0,
    timedOut: false
  }

  for (let i = 0; i < MAX_BATCH; i++) {
    if (Date.now() >= deadline) {
      result.timedOut = true
      break
    }

    const job = await GeocodingJobModel.findOneAndUpdate(
      {
        status: 'pending',
        nextAttemptAt: { $lte: new Date() }
      },
      {
        $set: {
          status: 'processing',
          lastAttemptAt: new Date()
        },
        $inc: { attemptCount: 1 }
      },
      { sort: { nextAttemptAt: 1 }, new: true }
    )

    if (!job) break

    result.processed++

    const query = composeAddress(job.addressSnapshot)
    let geocodeResult: { lat: number; lng: number } | null = null
    if (query) {
      geocodeResult = await geocodeViaNominatim(query)
    }

    if (geocodeResult) {
      await VenueModel.updateOne(
        { _id: job.venueId },
        { $set: { location: { type: 'Point', coordinates: [geocodeResult.lng, geocodeResult.lat] } } }
      )
      await GeocodingJobModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'completed',
            completedAt: new Date(),
            lastError: null
          }
        }
      )
      result.succeeded++
    } else {
      const reason = query ? 'No geocoding result' : 'Empty address'
      const attempts = job.attemptCount
      if (attempts >= MAX_ATTEMPTS) {
        await GeocodingJobModel.updateOne(
          { _id: job._id },
          {
            $set: {
              status: 'failed',
              lastError: reason
            }
          }
        )
        result.failed++
        console.warn(
          `[geocoding] Job ${job._id} failed permanently for venue ${job.venueId}: ${reason}`
        )
      } else {
        const delay = backoffDelay(attempts - 1)
        await GeocodingJobModel.updateOne(
          { _id: job._id },
          {
            $set: {
              status: 'pending',
              nextAttemptAt: new Date(Date.now() + delay),
              lastError: reason
            }
          }
        )
        result.retryScheduled++
      }
    }

    if (Date.now() >= deadline) {
      result.timedOut = true
      break
    }
    await sleep(THROTTLE_MS)
  }

  return result
}
