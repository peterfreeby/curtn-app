// Phase 7 — anti-abuse tuning constants. All values are intentionally generous
// for human power-users; the goal is to bound automated/drive-by abuse, not
// throttle real contributors. Tune from observed signal once production data
// is available. See Projects/Claim & Edit Authority Model — Phase 7 — Scoping.

export const ANTI_ABUSE = {
  PER_RECORD_LIMIT: 5,           // edits per user per record per 24h
  GLOBAL_VELOCITY_LIMIT: 100,    // edits per user per 24h, total
  AUTOCONFIRMED_DAYS: 4,
  AUTOCONFIRMED_EDITS: 10,
  BLOCK_VOLUME_ALERT_THRESHOLD: 10,
  BLOCK_VOLUME_ALERT_WINDOW_DAYS: 30,
} as const

export const ONE_DAY_MS = 24 * 60 * 60 * 1000
