"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/useAuth";

// Passive "claim this" call-to-action shown on unclaimed entity pages.
// See Projects/Claim & Edit Authority Model — Phase 2 Q18 decision.
//
// Renders nothing when:
//   - Unit is already claimed (claim-passive or claim-synced)
//   - Unit is provisionally-claimed (someone has an in-flight claim)
//   - Viewer isn't logged in (we surface a generic sign-in elsewhere)
//
// Otherwise renders a subtle banner inviting the right person to claim.

export type ClaimableKind = "venue" | "productionCompany" | "person";

interface ClaimCTAProps {
  kind: ClaimableKind;
  slug: string;
  name: string;
  claimState: string;
}

const KIND_LABELS: Record<ClaimableKind, { article: string; noun: string }> = {
  venue: { article: "the", noun: "venue" },
  productionCompany: { article: "this", noun: "company" },
  person: { article: "this", noun: "profile" },
};

export function ClaimCTA({ kind, slug, name, claimState }: ClaimCTAProps) {
  const { user } = useAuth();

  if (claimState !== "unclaimed") return null;
  if (!user) return null;

  const { article, noun } = KIND_LABELS[kind];

  return (
    <div className="rounded-lg border border-curtn-dark bg-curtn-surface/60 px-4 py-3 flex items-center justify-between gap-4">
      <div className="text-sm text-curtn-muted">
        Are you {article} manager of <span className="text-curtn-cream font-medium">{name}</span>?
        Claim {noun === "profile" ? "your" : "this"} {noun} to manage its info on Curtn.
      </div>
      <Link
        href={`/claim/${kind}/${slug}`}
        className="shrink-0 rounded-md bg-curtn-coral px-3 py-1.5 text-xs font-bold text-curtn-deep hover:bg-curtn-red transition-colors"
      >
        Claim
      </Link>
    </div>
  );
}
