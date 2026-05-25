import type { AppUsage } from './types'

export type WaitReason = 'pace' | 'graduated' | 'cooldown' | 'rate-limit-retry'

export interface RateGovernorOptions {
  /** Begin slowing down at this app-usage % (default 70). */
  softThresholdPct?: number
  /** Pause for a cooldown chunk at/above this % (default 85). */
  hardThresholdPct?: number
  /** Normal delay between calls (default 1500ms). */
  baseDelayMs?: number
  /** Cap on the graduated delay in the soft..hard band (default 20000ms). */
  maxGraduatedDelayMs?: number
  /** Cooldown chunk when usage is hot or a call was throttled (default 5min). */
  cooldownMs?: number
  /**
   * Give up retrying after this much cumulative cooldown without recovery
   * (default 90min — comfortably longer than FB's 1-hour rolling window, so a
   * fully-saturated budget recovers before we quit).
   */
  maxCooldownTotalMs?: number
  onWait?: (info: { reason: WaitReason; ms: number; peakPct: number; cooldownSpentMs: number }) => void
}

/**
 * Adaptive throttle for the FB Graph API's rolling-hour budget. Reads the
 * app-global X-App-Usage after each call and:
 *   - paces normally below the soft threshold,
 *   - ramps the delay up across the soft..hard band,
 *   - pauses in cooldown chunks at/above the hard threshold,
 *   - on an actual throttle error, cools down and retries the same URL,
 *     giving up only after maxCooldownTotal (so a run can "rerack after an
 *     hour" and keep going until the whole list is done).
 *
 * The cooldown budget resets once usage recovers below the soft threshold.
 */
export class RateGovernor {
  private lastPeak = 0
  private cooldownSpentMs = 0
  private readonly o: Required<Omit<RateGovernorOptions, 'onWait'>> & Pick<RateGovernorOptions, 'onWait'>

  constructor(opts: RateGovernorOptions = {}) {
    this.o = {
      softThresholdPct: opts.softThresholdPct ?? 70,
      hardThresholdPct: opts.hardThresholdPct ?? 85,
      baseDelayMs: opts.baseDelayMs ?? 1500,
      maxGraduatedDelayMs: opts.maxGraduatedDelayMs ?? 20_000,
      cooldownMs: opts.cooldownMs ?? 300_000,
      maxCooldownTotalMs: opts.maxCooldownTotalMs ?? 5_400_000,
      onWait: opts.onWait
    }
  }

  private static peak(u?: AppUsage): number {
    return u ? Math.max(u.callCount, u.totalTime, u.totalCpuTime) : 0
  }

  /** Feed the latest usage (from a success or a throttled error response). */
  observe(usage?: AppUsage): void {
    if (usage) this.lastPeak = RateGovernor.peak(usage)
    if (this.lastPeak < this.o.softThresholdPct) this.cooldownSpentMs = 0 // recovered
  }

  /** Pace before a fresh attempt, based on last-known usage. */
  async awaitTurn(): Promise<void> {
    const peak = this.lastPeak
    if (peak >= this.o.hardThresholdPct) {
      await this.sleep(this.o.cooldownMs, 'cooldown', peak)
      this.cooldownSpentMs += this.o.cooldownMs
    } else if (peak >= this.o.softThresholdPct) {
      const span = this.o.hardThresholdPct - this.o.softThresholdPct
      const frac = span > 0 ? (peak - this.o.softThresholdPct) / span : 1
      const ms = Math.round(this.o.baseDelayMs + frac * (this.o.maxGraduatedDelayMs - this.o.baseDelayMs))
      await this.sleep(ms, 'graduated', peak)
    } else {
      await this.sleep(this.o.baseDelayMs, 'pace', peak)
    }
  }

  /**
   * Handle a throttle error: cool down a chunk and report whether the caller
   * should retry the same URL (true) or give up for now (false, when the
   * cumulative cooldown budget is exhausted).
   */
  async handleRateLimit(usage?: AppUsage): Promise<boolean> {
    this.observe(usage)
    if (this.cooldownSpentMs >= this.o.maxCooldownTotalMs) return false
    await this.sleep(this.o.cooldownMs, 'rate-limit-retry', this.lastPeak)
    this.cooldownSpentMs += this.o.cooldownMs
    return true
  }

  private async sleep(ms: number, reason: WaitReason, peakPct: number): Promise<void> {
    this.o.onWait?.({ reason, ms, peakPct, cooldownSpentMs: this.cooldownSpentMs })
    if (ms > 0) await new Promise(r => setTimeout(r, ms))
  }
}
