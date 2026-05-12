"use client";

import { useState } from "react";
import { useQuery, useMutation } from "urql";
import Link from "next/link";
import {
  AUTO_PROMOTED_CLAIMS_QUERY,
  ADMIN_REVOKE_AUTO_PROMOTION_MUTATION,
} from "@/lib/graphql/claim";

// Phase 8 — Admin tab listing auto-promoted claims. Each row shows the
// signal mix that triggered promotion. Admin can revoke; revocation transitions
// the unit back to `unclaimed` and notifies the former claimant.

interface AutoPromotedNode {
  id: string;
  status: string;
  message: string | null;
  requestedAt: string;
  user: { id: string; username: string; fullName: string };
  target: { kind: string; targetId: string; name: string | null; slug: string | null } | null;
  signals: {
    webmasterVerified: boolean;
    externalProfileLinks: Array<{ url: string; platform: string }>;
    trustGraphEndorsements: Array<{ grantingUnitKind: string | null }>;
    autoPromotionScore: number;
    autoPromotedAt: string | null;
  } | null;
}

const KIND_LABELS: Record<string, string> = {
  venue: "Venue",
  productionCompany: "Company",
  person: "Person",
};
const KIND_PATH_PREFIX: Record<string, string> = {
  venue: "/venues",
  productionCompany: "/companies",
  person: "/people",
};

function decodeGlobalId(globalId: string): string {
  const decoded = atob(globalId);
  return decoded.split(":")[1];
}

function timeSince(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AutoApprovedClaimsPage() {
  const [{ data, fetching }, reexecute] = useQuery({ query: AUTO_PROMOTED_CLAIMS_QUERY });
  const [{ fetching: revoking }, executeRevoke] = useMutation(ADMIN_REVOKE_AUTO_PROMOTION_MUTATION);
  const [message, setMessage] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  const items: AutoPromotedNode[] = data?.autoPromotedClaims?.edges?.map((e: any) => e.node) || [];

  async function handleRevoke(item: AutoPromotedNode) {
    setMessage(null);
    const reason = reasonById[item.id] ?? "";
    const result = await executeRevoke({
      input: { claimRequestId: decodeGlobalId(item.id), reason: reason || undefined },
    });
    const payload = result.data?.adminRevokeAutoPromotion;
    if (payload?.error) {
      setMessage(payload.error);
    } else {
      setMessage(`Revoked auto-promotion for @${item.user.username}.`);
      reexecute({ requestPolicy: "network-only" });
    }
  }

  function signalSummary(s: AutoPromotedNode["signals"]): string {
    if (!s) return "n/a";
    const parts: string[] = [];
    if (s.webmasterVerified) parts.push("webmaster");
    if (s.externalProfileLinks.length > 0) {
      parts.push(`profiles×${s.externalProfileLinks.length}`);
    }
    if (s.trustGraphEndorsements.length > 0) {
      parts.push(`trusted-by×${s.trustGraphEndorsements.length}`);
    }
    return parts.join(", ") || "n/a";
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-curtn-cream">Auto-Approved Claims</h1>
          <p className="mt-1 text-sm text-curtn-muted">
            Claims that auto-promoted via verification signals. Review and revoke if anything looks off.
          </p>
        </div>
        <Link href="/admin/claims" className="text-xs text-curtn-coral hover:underline shrink-0">
          ← Back to pending claims
        </Link>
      </div>

      {message && (
        <div className="rounded-lg border border-curtn-dark bg-curtn-surface px-4 py-3 text-sm text-curtn-cream">
          {message}
        </div>
      )}

      {fetching && (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
        </div>
      )}

      {!fetching && items.length === 0 && (
        <div className="rounded-lg border border-curtn-dark bg-curtn-surface px-6 py-10 text-center">
          <p className="text-sm text-curtn-muted">No auto-promoted claims yet.</p>
        </div>
      )}

      {!fetching && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const href = item.target?.slug
              ? `${KIND_PATH_PREFIX[item.target.kind]}/${item.target.slug}`
              : null;
            return (
              <div
                key={item.id}
                className="rounded-lg border border-curtn-dark bg-curtn-surface p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-green-400">
                        Auto-approved
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-curtn-muted">
                        {item.target ? KIND_LABELS[item.target.kind] ?? item.target.kind : "?"}
                      </span>
                      <span className="text-xs text-curtn-muted">
                        {timeSince(item.signals?.autoPromotedAt ?? null)}
                      </span>
                    </div>
                    <p className="text-sm text-curtn-cream">
                      <Link href={`/u/${item.user.username}`} className="text-curtn-coral hover:underline">
                        @{item.user.username}
                      </Link>
                      {" "}claimed{" "}
                      {href ? (
                        <Link href={href} className="text-curtn-coral hover:underline">
                          {item.target?.name ?? "(unknown)"}
                        </Link>
                      ) : (
                        <span>{item.target?.name ?? "(unknown)"}</span>
                      )}
                    </p>
                    <p className="text-xs text-curtn-muted">
                      Signals: {signalSummary(item.signals)} ({item.signals?.autoPromotionScore ?? 0} pts)
                    </p>
                    {item.signals?.externalProfileLinks && item.signals.externalProfileLinks.length > 0 && (
                      <ul className="text-[11px] text-curtn-muted/80 mt-1">
                        {item.signals.externalProfileLinks.map((l, i) => (
                          <li key={i}>
                            <a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {l.platform}: {l.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="space-y-2 border-t border-curtn-dark pt-3">
                  <textarea
                    value={reasonById[item.id] ?? ""}
                    onChange={(e) => setReasonById((p) => ({ ...p, [item.id]: e.target.value }))}
                    placeholder="Optional reason (recorded in AuditLog; visible to claimant)"
                    rows={2}
                    className="w-full rounded-md border border-curtn-dark bg-curtn-deep px-3 py-2 text-xs text-curtn-cream placeholder:text-curtn-muted/60 focus:border-curtn-coral focus:outline-none"
                  />
                  <button
                    onClick={() => handleRevoke(item)}
                    disabled={revoking}
                    className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Revoke auto-promotion
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
