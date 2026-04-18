import { Types } from 'mongoose'
import { GeocodingJobModel } from '../../entities/geocodingJob/geocodingJobModel'

export interface AddressSnapshot {
  address?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
}

function normalize(input: AddressSnapshot) {
  return {
    address: input.address?.trim() || undefined,
    city: input.city?.trim() || undefined,
    state: input.state?.trim() || undefined,
    zipCode: input.zipCode?.trim() || undefined
  }
}

function hasAnyAddress(snapshot: AddressSnapshot): boolean {
  return !!(snapshot.address || snapshot.city || snapshot.state || snapshot.zipCode)
}

// Upsert a pending geocoding job for a venue. If a pending job already exists,
// overwrite its snapshot with the latest address (the user's final edit wins).
// If a processing/completed/failed job exists, this inserts a new pending job;
// the worker will process the stale one first, then pick this up with the
// newer address on the next tick.
export async function enqueueGeocodingJob(
  venueId: Types.ObjectId | string,
  snapshot: AddressSnapshot
): Promise<void> {
  const normalized = normalize(snapshot)
  if (!hasAnyAddress(normalized)) return

  const id = typeof venueId === 'string' ? new Types.ObjectId(venueId) : venueId

  try {
    await GeocodingJobModel.findOneAndUpdate(
      { venueId: id, status: 'pending' },
      {
        $set: {
          addressSnapshot: normalized,
          nextAttemptAt: new Date(),
          attemptCount: 0,
          lastError: null
        },
        $setOnInsert: {
          venueId: id,
          status: 'pending'
        }
      },
      { upsert: true, new: true }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[geocoding] Failed to enqueue job for venue ${id}: ${message}`)
  }
}
