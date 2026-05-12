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
  GET_CLAIM_SIGNALS_QUERY,
  GENERATE_WEBMASTER_TOKEN_MUTATION,
  VERIFY_WEBMASTER_MUTATION,
  LINK_EXTERNAL_PROFILE_MUTATION,
} from "@/lib/graphql/claim";
import { useAuth } from "@/lib/auth/useAuth";

function decodeGlobalId(globalId: string): string {
  return atob(globalId).split(":")[1];
}

// Phase 8 — "Verify faster" panel. Appears post-submission so the claimant
// can issue a webmaster token, link external profiles, and watch the
// auto-promotion score tick up live.

interface ClaimSignalsView {
  id: string;
  status: string;
  signals: {
    webmasterVerified: boolean;
    webmasterToken: string | null;
    webmasterTokenExpires: string | null;
    externalProfileLinks: Array<{ url: string; platform: string; verifiedAt: string | null }>;
    trustGraphEndorsements: Array<{ grantingUnitKind: string | null }>;
    autoPromotionScore: number;
    autoPromotedAt: string | null;
  } | null;
}

function VerifyFasterPanel({
  claimRequestId,
  initialClaim,
  onAutoPromoted,
}: {
  claimRequestId: string;
  initialClaim: ClaimSignalsView | null;
  onAutoPromoted: () => void;
}) {
  const [{ data, fetching }, reexecute] = useQuery({
    query: GET_CLAIM_SIGNALS_QUERY,
    variables: { claimRequestId: decodeGlobalId(claimRequestId) },
  });
  const claim: ClaimSignalsView | null = data?.getClaimSignals ?? initialClaim;
  const signals = claim?.signals ?? null;

  const [{ fetching: generating }, executeGenerate] = useMutation(GENERATE_WEBMASTER_TOKEN_MUTATION);
  const [{ fetching: verifying }, executeVerify] = useMutation(VERIFY_WEBMASTER_MUTATION);
  const [{ fetching: linking }, executeLink] = useMutation(LINK_EXTERNAL_PROFILE_MUTATION);

  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [issuedWebsite, setIssuedWebsite] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState("");
  const [panelError, setPanelError] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);

  // If already auto-promoted, surface it and let parent re-route.
  if (signals?.autoPromotedAt) {
    onAutoPromoted();
  }

  async function handleGenerate() {
    setPanelError(null);
    const res = await executeGenerate({
      input: { claimRequestId: decodeGlobalId(claimRequestId) },
    });
    const payload = res.data?.generateWebmasterToken;
    if (payload?.error) {
      setPanelError(payload.error);
      return;
    }
    setIssuedToken(payload.token ?? null);
    setIssuedWebsite(payload.website ?? null);
    reexecute({ requestPolicy: "network-only" });
  }

  async function handleVerify() {
    setPanelError(null);
    setVerifyStatus(null);
    const res = await executeVerify({
      input: { claimRequestId: decodeGlobalId(claimRequestId) },
    });
    const payload = res.data?.verifyWebmaster;
    if (payload?.error) {
      setPanelError(payload.error);
      setVerifyStatus("failed");
      return;
    }
    setVerifyStatus(payload.verified === "true" ? "verified" : "failed");
    reexecute({ requestPolicy: "network-only" });
  }

  async function handleLink() {
    setPanelError(null);
    if (!profileUrl.trim()) return;
    const res = await executeLink({
      input: { claimRequestId: decodeGlobalId(claimRequestId), url: profileUrl.trim() },
    });
    const payload = res.data?.linkExternalProfile;
    if (payload?.error) {
      setPanelError(payload.error);
      return;
    }
    setProfileUrl("");
    reexecute({ requestPolicy: "network-only" });
  }

  const score = signals?.autoPromotionScore ?? 0;
  const endorsementCount = signals?.trustGraphEndorsements?.length ?? 0;
  const linkCount = signals?.externalProfileLinks?.length ?? 0;

  return (
    <div className="space-y-4 rounded-lg border border-curtn-dark bg-curtn-surface px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-bold text-curtn-cream">Verify faster</h2>
        <div className="text-xs text-curtn-muted">
          <span className="text-curtn-cream font-medium">{score}</span> / 100 to auto-approve
        </div>
      </div>

      {/* Trust graph (read-only informational) */}
      <div className="text-xs text-curtn-muted">
        {endorsementCount > 0
          ? `Trust graph: ${endorsementCount} unit(s) have endorsed you via TrustedEditor grants.`
          : "Trust graph: no endorsements yet. Once another claimed unit grants you Manager-scope trust, it counts here."}
      </div>

      {/* Webmaster verification */}
      <div className="space-y-2 border-t border-curtn-dark pt-3">
        <div className="text-xs uppercase tracking-wider text-curtn-muted">Webmaster verification (100 pts)</div>
        {signals?.webmasterVerified ? (
          <div className="text-xs text-green-400">Webmaster verified.</div>
        ) : (
          <>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-md bg-curtn-deep px-3 py-1.5 text-xs font-medium text-curtn-cream hover:bg-curtn-dark transition-colors cursor-pointer disabled:opacity-50"
            >
              {generating ? "Generating…" : signals?.webmasterToken ? "Re-issue token" : "Generate token"}
            </button>
            {issuedToken && (
              <div className="space-y-2 rounded-md border border-curtn-dark bg-curtn-deep/70 px-3 py-2 text-[11px] text-curtn-muted">
                <div>
                  Add this token to <span className="text-curtn-cream">{issuedWebsite}</span> via either:
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-black/40 p-2 text-curtn-cream">
{`<meta name="curtn-verify" content="${issuedToken}">`}
                </pre>
                <div>...or a DNS TXT record:</div>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-black/40 p-2 text-curtn-cream">
{`curtn-verify=${issuedToken}`}
                </pre>
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="mt-2 rounded-md bg-curtn-coral px-3 py-1.5 text-xs font-medium text-curtn-deep hover:bg-curtn-red transition-colors disabled:opacity-50"
                >
                  {verifying ? "Verifying…" : "Verify now"}
                </button>
                {verifyStatus === "failed" && (
                  <div className="text-red-400">Verification failed — double-check the tag, then try again.</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* External profile linking */}
      <div className="space-y-2 border-t border-curtn-dark pt-3">
        <div className="text-xs uppercase tracking-wider text-curtn-muted">
          Link external profiles (30 pts each, up to 75)
        </div>
        <div className="flex gap-2">
          <input
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            placeholder="https://www.wikidata.org/wiki/Q..."
            className="flex-1 rounded-md border border-curtn-dark bg-curtn-deep px-3 py-1.5 text-xs text-curtn-cream placeholder:text-curtn-muted/60 focus:border-curtn-coral focus:outline-none"
          />
          <button
            onClick={handleLink}
            disabled={linking || !profileUrl.trim()}
            className="rounded-md bg-curtn-deep px-3 py-1.5 text-xs font-medium text-curtn-cream hover:bg-curtn-dark transition-colors cursor-pointer disabled:opacity-50"
          >
            {linking ? "Linking…" : "Link"}
          </button>
        </div>
        {linkCount > 0 && signals?.externalProfileLinks && (
          <ul className="text-[11px] text-curtn-muted space-y-0.5">
            {signals.externalProfileLinks.map((l, i) => (
              <li key={i}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {l.platform}: {l.url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {panelError && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {panelError}
        </div>
      )}
      {fetching && <div className="text-[11px] text-curtn-muted">Refreshing…</div>}
    </div>
  );
}

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
  const [submittedClaimId, setSubmittedClaimId] = useState<string | null>(null);
  const [autoPromoted, setAutoPromoted] = useState(false);
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
      <div className="px-6 py-12 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-curtn-cream">
            {autoPromoted ? "Claim auto-approved!" : "Claim submitted"}
          </h1>
          <p className="mt-2 text-sm text-curtn-muted">
            {autoPromoted
              ? `Your claim on ${unit.name} was auto-approved via verification signals.`
              : `Your claim on ${unit.name} is pending admin review. Speed it up by adding verification signals below.`}
          </p>
        </div>
        {!autoPromoted && submittedClaimId && (
          <VerifyFasterPanel
            claimRequestId={submittedClaimId}
            initialClaim={null}
            onAutoPromoted={() => setAutoPromoted(true)}
          />
        )}
        <Link href="/dashboard" className="inline-block text-sm text-curtn-coral hover:underline">
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

    setSubmittedClaimId(payload?.claimRequest?.id ?? null);
    if (payload?.claimRequest?.signals?.autoPromotedAt) {
      setAutoPromoted(true);
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
