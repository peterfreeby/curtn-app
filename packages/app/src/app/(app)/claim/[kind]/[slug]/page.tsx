"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "urql";
import {
  SUBMIT_CLAIM_MUTATION,
  VENUE_FOR_CLAIM_QUERY,
  COMPANY_FOR_CLAIM_QUERY,
  PERSON_FOR_CLAIM_QUERY,
} from "@/lib/graphql/claim";
import { useAuth } from "@/lib/auth/useAuth";

type ClaimableKind = "venue" | "productionCompany" | "person";

const VALID_KINDS: ClaimableKind[] = ["venue", "productionCompany", "person"];

const KIND_TO_QUERY = {
  venue: { query: VENUE_FOR_CLAIM_QUERY, root: "venueBySlug" },
  productionCompany: { query: COMPANY_FOR_CLAIM_QUERY, root: "productionCompanyBySlug" },
  person: { query: PERSON_FOR_CLAIM_QUERY, root: "personBySlug" },
};

function decodeId(globalId: string): string {
  return atob(globalId).split(":")[1];
}

export default function ClaimPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const kind = params.kind as ClaimableKind;
  const slug = params.slug as string;

  const [evidence, setEvidence] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidKind = VALID_KINDS.includes(kind);
  const queryConfig = isValidKind ? KIND_TO_QUERY[kind] : KIND_TO_QUERY.venue;

  const [{ data, fetching }] = useQuery({
    query: queryConfig.query,
    variables: { slug },
    pause: !isValidKind,
  });

  const [{ fetching: submitting }, executeSubmit] = useMutation(SUBMIT_CLAIM_MUTATION);

  if (!isValidKind) {
    return (
      <div className="px-6 py-12 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-curtn-cream">Invalid claim target</h1>
        <p className="mt-2 text-sm text-curtn-muted">
          Claims must target a venue, production company, or person profile.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-6 py-12 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-curtn-cream">Sign in to claim</h1>
        <p className="mt-2 text-sm text-curtn-muted">
          You need to be signed in to claim a venue, company, or profile.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm text-curtn-coral hover:underline">
          Sign in →
        </Link>
      </div>
    );
  }

  if (fetching) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
      </div>
    );
  }

  const unit = (data as Record<string, any>)?.[queryConfig.root];

  if (!unit) {
    return (
      <div className="px-6 py-12 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-curtn-cream">Not found</h1>
        <p className="mt-2 text-sm text-curtn-muted">
          We couldn't find that {kind === "productionCompany" ? "company" : kind} to claim.
        </p>
      </div>
    );
  }

  if (unit.claimState === "claimed-passive" || unit.claimState === "claimed-synced") {
    return (
      <div className="px-6 py-12 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-curtn-cream">Already claimed</h1>
        <p className="mt-2 text-sm text-curtn-muted">
          {unit.name} is already claimed
          {unit.claimedBy ? ` by @${unit.claimedBy.username}` : ""}.
          If you believe this is in error, contact Curtn admin.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="px-6 py-12 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-curtn-cream">Claim submitted</h1>
        <p className="mt-2 text-sm text-curtn-muted">
          Your claim on {unit.name} is now pending admin review. You'll get a notification once it's
          approved or declined.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-curtn-coral hover:underline">
          Go to your dashboard →
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (evidence.trim().length < 10) {
      setError("Please provide a bit more context — at least a sentence.");
      return;
    }

    const result = await executeSubmit({
      input: {
        targetKind: kind,
        targetId: decodeId(unit.id),
        evidence: evidence.trim(),
      },
    });

    const payload = result.data?.submitClaim;
    if (payload?.error) {
      setError(payload.error);
      return;
    }
    if (result.error) {
      setError(result.error.message);
      return;
    }

    setSubmitted(true);
  }

  return (
    <div className="px-6 py-12 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-curtn-cream">Claim {unit.name}</h1>
        <p className="mt-1 text-sm text-curtn-muted">
          Tell us why you're the right person to claim this {kind === "productionCompany" ? "company" : kind}.
          A Curtn admin will review your request before approving.
        </p>
      </div>

      {unit.claimState === "provisionally-claimed" && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-300">
          Heads up: there's already a pending claim on this {kind}. You can still submit; admin will
          consider all pending requests together.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="evidence" className="block text-xs uppercase tracking-wider text-curtn-muted mb-2">
            Evidence
          </label>
          <textarea
            id="evidence"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            rows={8}
            placeholder="Your role, your website, your social, anything that helps Curtn confirm you're the right steward of this record."
            className="w-full rounded-lg border border-curtn-dark bg-curtn-surface px-4 py-3 text-sm text-curtn-cream placeholder:text-curtn-muted/60 focus:border-curtn-coral focus:outline-none"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-curtn-coral px-4 py-2 text-sm font-bold text-curtn-deep hover:bg-curtn-red transition-colors disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit claim"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-curtn-muted hover:text-curtn-cream transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
