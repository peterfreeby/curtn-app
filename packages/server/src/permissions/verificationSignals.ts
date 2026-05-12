// Phase 8 — verification-signal tuning constants.
//
// Each available signal contributes points toward an auto-promotion score.
// When score >= AUTO_PROMOTE_THRESHOLD the claim is auto-approved without
// admin review. Below threshold, the claim sits in the standard pending
// queue with signals surfaced to the reviewer.
//
// Important Curtn note: the design lists a `SAME_EMAIL_DOMAIN_AS_WEBSITE`
// signal that can't be computed in v1 — Curtn users only have phone numbers
// (Firebase phone auth) and the User model has no email field. We keep the
// constant in the catalog at 0 points to make the gap explicit; future work
// can populate it once email is added (deferred indefinitely per the
// 2026-05-11 cross-phase decision recorded in project memory).
//
// All values are tunable; they're initial guesses. Watch the false-promote
// rate after launch and adjust.

export const SIGNAL_POINTS = {
  WEBMASTER_VERIFIED: 100,
  EXTERNAL_PROFILE_LINKED: 30,
  EXTERNAL_PROFILE_LINKED_CAP: 75,
  TRUST_GRAPH_ENDORSEMENT: 25,
  TRUST_GRAPH_ENDORSEMENT_CAP: 75,
  // No email on User in Curtn (Firebase phone auth only). Set to 0 in v1; the
  // signal is documented but uncomputable.
  SAME_EMAIL_DOMAIN_AS_WEBSITE: 0,
  PRIOR_APPROVED_CLAIM: 20,
  EVIDENCE_TEXT_QUALITY_MAX: 15,
  AUTO_PROMOTE_THRESHOLD: 100,
} as const

export type SignalKey = keyof typeof SIGNAL_POINTS
