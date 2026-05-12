"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "urql";
import { MARK_NOTIFICATION_READ_MUTATION } from "@/lib/graphql/notifications";
import { ACCEPT_RECIPROCITY_MUTATION } from "@/lib/graphql/trust";

// One render per notification kind. Each kind reads `context` (parsed from
// contextJson) for the bits it needs.

export type NotificationKind =
  | "claim_approved"
  | "claim_declined"
  | "transfer_received"
  | "transfer_accepted"
  | "transfer_declined"
  | "pre_expire_warning"
  | "claim_expired"
  | "proposal_received"
  | "proposal_approved"
  | "proposal_declined"
  | "proposal_timeout_warning"
  | "proposal_timeout_auto_approved"
  | "trust_granted"
  | "trust_revoked"
  | "reciprocity_offered"
  | "sync_connected"
  | "sync_conflict_detected"
  | "sync_stale_alert"
  | "sync_recovered"
  | "sync_reverted_to_passive"
  | "sync_disconnected"
  // Phase 8 — verification signals / auto-promotion
  | "claim_auto_approved"
  | "claim_signals_insufficient"
  | "webmaster_verification_failed"
  | "webmaster_verification_succeeded";

export interface NotificationData {
  id: string;
  kind: string;
  contextJson: string | null;
  readAt: string | null;
  createdAt: string;
}

const KIND_PATH_PREFIX: Record<string, string> = {
  venue: "/venues",
  productionCompany: "/companies",
  person: "/people",
};

// Phase 4 proposal kinds use the PascalCase target.kind from GraphQL.
const PROPOSAL_TARGET_PATH_PREFIX: Record<string, string> = {
  Venue: "/venues",
  ProductionCompany: "/companies",
  Person: "/people",
};

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function parseContext(json: string | null): Record<string, any> {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function renderBody(notification: NotificationData) {
  const ctx = parseContext(notification.contextJson);
  const kind = notification.kind as NotificationKind;

  switch (kind) {
    case "claim_approved": {
      const slug = ctx.targetSlug as string | undefined;
      const path = ctx.targetKind && slug ? `${KIND_PATH_PREFIX[ctx.targetKind]}/${slug}` : null;
      return (
        <p className="text-sm text-curtn-cream">
          Your claim on{" "}
          {path ? (
            <Link href={path} className="text-curtn-coral hover:underline font-medium">
              {ctx.targetName ?? "your unit"}
            </Link>
          ) : (
            <span className="font-medium">{ctx.targetName ?? "your unit"}</span>
          )}{" "}
          was approved.
          {ctx.reviewerNotes ? (
            <span className="block mt-1 text-xs text-curtn-muted italic">
              Reviewer notes: {ctx.reviewerNotes}
            </span>
          ) : null}
        </p>
      );
    }

    case "claim_declined": {
      return (
        <p className="text-sm text-curtn-cream">
          Your claim on <span className="font-medium">{ctx.targetName ?? "your unit"}</span> was declined.
          {ctx.reviewerNotes ? (
            <span className="block mt-1 text-xs text-curtn-muted italic">
              Reviewer notes: {ctx.reviewerNotes}
            </span>
          ) : null}
        </p>
      );
    }

    case "transfer_received": {
      return (
        <p className="text-sm text-curtn-cream">
          <span className="font-medium">{ctx.fromUsername ? `@${ctx.fromUsername}` : "Someone"}</span>{" "}
          wants to transfer{" "}
          <span className="font-medium">{ctx.targetName ?? "a unit"}</span> to you.{" "}
          <Link href="/dashboard" className="text-curtn-coral hover:underline">
            Review →
          </Link>
        </p>
      );
    }

    case "transfer_accepted": {
      return (
        <p className="text-sm text-curtn-cream">
          <span className="font-medium">{ctx.toUsername ? `@${ctx.toUsername}` : "The recipient"}</span>{" "}
          accepted your transfer of <span className="font-medium">{ctx.targetName ?? "your unit"}</span>.
        </p>
      );
    }

    case "transfer_declined": {
      return (
        <p className="text-sm text-curtn-cream">
          <span className="font-medium">{ctx.toUsername ? `@${ctx.toUsername}` : "The recipient"}</span>{" "}
          declined your transfer of <span className="font-medium">{ctx.targetName ?? "your unit"}</span>.
        </p>
      );
    }

    case "pre_expire_warning": {
      return (
        <p className="text-sm text-curtn-cream">
          Heads up — your claim on <span className="font-medium">{ctx.targetName ?? "a unit"}</span>{" "}
          will expire in 30 days unless you log in or make an edit.
        </p>
      );
    }

    case "claim_expired": {
      return (
        <p className="text-sm text-curtn-cream">
          Your claim on <span className="font-medium">{ctx.targetName ?? "a unit"}</span> has expired
          due to inactivity. It's been returned to the unclaimed pool.
        </p>
      );
    }

    case "proposal_received": {
      const slug = ctx.targetSlug as string | undefined;
      const path = ctx.targetKind && slug && PROPOSAL_TARGET_PATH_PREFIX[ctx.targetKind]
        ? `${PROPOSAL_TARGET_PATH_PREFIX[ctx.targetKind]}/${slug}`
        : null;
      const author = ctx.proposerKind === "Scraper"
        ? (ctx.proposerLabel ?? "Curtn scraper")
        : (ctx.proposerLabel ? `@${ctx.proposerLabel}` : "Someone");
      const isImport = !!ctx.isImport;
      return (
        <p className="text-sm text-curtn-cream">
          <span className="font-medium">{author}</span> proposed {isImport ? "a new import" : "an edit"} to{" "}
          {path ? (
            <Link href={path} className="text-curtn-coral hover:underline font-medium">
              {ctx.targetName ?? "a unit"}
            </Link>
          ) : (
            <span className="font-medium">{ctx.targetName ?? "a unit"}</span>
          )}
          .{" "}
          <Link href="/dashboard" className="text-curtn-coral hover:underline">Review →</Link>
        </p>
      );
    }

    case "proposal_approved": {
      return (
        <p className="text-sm text-curtn-cream">
          Your proposed edit was approved.
          {ctx.targetName ? <> Applied to <span className="font-medium">{ctx.targetName}</span>.</> : null}
        </p>
      );
    }

    case "proposal_declined": {
      return (
        <p className="text-sm text-curtn-cream">
          Your proposed edit was declined.
          {ctx.declineReason ? (
            <span className="block mt-1 text-xs text-curtn-muted italic">Reason: {ctx.declineReason}</span>
          ) : null}
        </p>
      );
    }

    case "proposal_timeout_warning": {
      return (
        <p className="text-sm text-curtn-cream">
          A joint proposal on <span className="font-medium">{ctx.targetName ?? "a performance"}</span>{" "}
          is waiting on your response. It will auto-approve in 4 more days if you don't act.{" "}
          <Link href="/dashboard" className="text-curtn-coral hover:underline">Review →</Link>
        </p>
      );
    }

    case "proposal_timeout_auto_approved": {
      return (
        <p className="text-sm text-curtn-cream">
          A joint proposal was auto-approved after 14 days without a second response.
          {ctx.targetName ? <> Applied to <span className="font-medium">{ctx.targetName}</span>.</> : null}
        </p>
      );
    }

    case "trust_granted": {
      const recipientLabel = ctx.recipientName
        ? <> for <span className="font-medium">{ctx.recipientName}</span></>
        : null;
      const grantedOnPath = ctx.grantedOnKind && ctx.grantedOnSlug && PROPOSAL_TARGET_PATH_PREFIX[ctx.grantedOnKind]
        ? `${PROPOSAL_TARGET_PATH_PREFIX[ctx.grantedOnKind]}/${ctx.grantedOnSlug}`
        : null;
      return (
        <p className="text-sm text-curtn-cream">
          You've been added as a trusted editor on{" "}
          {grantedOnPath ? (
            <Link href={grantedOnPath} className="text-curtn-coral hover:underline font-medium">
              {ctx.grantedOnName ?? "a unit"}
            </Link>
          ) : (
            <span className="font-medium">{ctx.grantedOnName ?? "a unit"}</span>
          )}
          {recipientLabel}
          {ctx.roleTemplate ? <> · {ctx.roleTemplate}</> : null}.{" "}
          <Link href="/dashboard/trust" className="text-curtn-coral hover:underline">Manage →</Link>
        </p>
      );
    }

    case "trust_revoked": {
      return (
        <p className="text-sm text-curtn-cream">
          Your trusted-editor access on <span className="font-medium">{ctx.grantedOnName ?? "a unit"}</span> has been revoked.
        </p>
      );
    }

    case "reciprocity_offered":
      // Rendered by the dedicated card below — surfaces an Accept button.
      return null;

    case "sync_connected": {
      const slug = ctx.targetSlug as string | undefined;
      const path = slug ? `/venues/${slug}` : null;
      return (
        <p className="text-sm text-curtn-cream">
          Sync source connected to{" "}
          {path ? (
            <Link href={path} className="text-curtn-coral hover:underline font-medium">
              {ctx.targetName ?? "your venue"}
            </Link>
          ) : (
            <span className="font-medium">{ctx.targetName ?? "your venue"}</span>
          )}
          . Curtn will pull updates from your {ctx.feedType?.toUpperCase?.() ?? "feed"} automatically.
        </p>
      );
    }

    case "sync_conflict_detected": {
      return (
        <p className="text-sm text-curtn-cream">
          Your sync feed proposed a change to <span className="font-medium">{ctx.field ?? "a field"}</span> that
          conflicts with a manual edit.{" "}
          <Link href="/dashboard" className="text-curtn-coral hover:underline">Review →</Link>
        </p>
      );
    }

    case "sync_stale_alert": {
      const slug = ctx.targetSlug as string | undefined;
      const path = slug ? `/venues/${slug}` : null;
      return (
        <p className="text-sm text-curtn-cream">
          Your sync feed on{" "}
          {path ? (
            <Link href={path} className="text-curtn-coral hover:underline font-medium">
              {ctx.targetName ?? "your venue"}
            </Link>
          ) : (
            <span className="font-medium">{ctx.targetName ?? "your venue"}</span>
          )}{" "}
          hasn't published in 3 weeks. Fix the feed, switch sources, or have us take over.
        </p>
      );
    }

    case "sync_recovered": {
      return (
        <p className="text-sm text-curtn-cream">
          Your sync feed on <span className="font-medium">{ctx.targetName ?? "your venue"}</span> is publishing again. Healthy.
        </p>
      );
    }

    case "sync_reverted_to_passive": {
      return (
        <p className="text-sm text-curtn-cream">
          Your sync feed on <span className="font-medium">{ctx.targetName ?? "your venue"}</span> was silent for 6 weeks. We've
          turned sync off and resumed scraper publishing. Reconnect a feed anytime from{" "}
          <Link href="/dashboard" className="text-curtn-coral hover:underline">your dashboard</Link>.
        </p>
      );
    }

    case "sync_disconnected": {
      return (
        <p className="text-sm text-curtn-cream">
          You disconnected sync from <span className="font-medium">{ctx.targetName ?? "your venue"}</span>. The unit is back to passive.
        </p>
      );
    }

    case "claim_auto_approved": {
      const slug = ctx.targetSlug as string | undefined;
      const path = ctx.targetKind && slug ? `${KIND_PATH_PREFIX[ctx.targetKind]}/${slug}` : null;
      const isForAdmin = !!ctx.forAdmin;
      const signals: string[] = Array.isArray(ctx.signals) ? ctx.signals : [];
      return (
        <p className="text-sm text-curtn-cream">
          {isForAdmin ? (
            <>Claim auto-approved on </>
          ) : (
            <>Your claim on </>
          )}
          {path ? (
            <Link href={path} className="text-curtn-coral hover:underline font-medium">
              {ctx.targetName ?? "a unit"}
            </Link>
          ) : (
            <span className="font-medium">{ctx.targetName ?? "a unit"}</span>
          )}
          {" "}was auto-approved
          {ctx.score != null ? <> ({ctx.score} pts)</> : null}.
          {signals.length > 0 ? (
            <span className="block mt-1 text-xs text-curtn-muted italic">
              Signals: {signals.join(", ")}
            </span>
          ) : null}
        </p>
      );
    }

    case "claim_signals_insufficient": {
      return (
        <p className="text-sm text-curtn-cream">
          Your claim on <span className="font-medium">{ctx.targetName ?? "a unit"}</span> was submitted
          ({ctx.score ?? 0} / {ctx.threshold ?? 100} pts) — admin will review.
          {" "}Add a webmaster meta tag or link an external profile to speed it up.
        </p>
      );
    }

    case "webmaster_verification_failed": {
      return (
        <p className="text-sm text-curtn-cream">
          Webmaster verification failed{ctx.website ? <> for <span className="font-medium">{ctx.website}</span></> : null}.
          {ctx.reason ? (
            <span className="block mt-1 text-xs text-curtn-muted italic">{ctx.reason}</span>
          ) : null}
        </p>
      );
    }

    case "webmaster_verification_succeeded": {
      return (
        <p className="text-sm text-curtn-cream">
          Webmaster verified{ctx.website ? <> for <span className="font-medium">{ctx.website}</span></> : null}
          {ctx.method ? <> ({ctx.method === "txt" ? "DNS TXT" : "meta tag"})</> : null}.
          Your claim should auto-approve momentarily.
        </p>
      );
    }

    default:
      return <p className="text-sm text-curtn-muted">Notification: {notification.kind}</p>;
  }
}

// Reciprocity offer needs an inline Accept button. Splits out so the urql
// mutation hook stays scoped to the card.
function ReciprocityOfferBody({ notification }: { notification: NotificationData }) {
  const ctx = parseContext(notification.contextJson);
  const [accepted, setAccepted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [{ fetching }, executeAccept] = useMutation(ACCEPT_RECIPROCITY_MUTATION);

  const grantedOnPath = ctx.grantedOnKind && ctx.grantedOnSlug && PROPOSAL_TARGET_PATH_PREFIX[ctx.grantedOnKind]
    ? `${PROPOSAL_TARGET_PATH_PREFIX[ctx.grantedOnKind]}/${ctx.grantedOnSlug}`
    : null;

  async function handleAccept(e: React.MouseEvent) {
    e.stopPropagation();
    if (accepted || fetching) return;
    setErrorMsg(null);
    const res = await executeAccept({
      input: { originalTrustedEditorId: ctx.trustedEditorId },
    });
    const payload = res.data?.acceptReciprocity;
    if (payload?.error) {
      setErrorMsg(payload.error);
      return;
    }
    setAccepted(true);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-curtn-cream">
        {grantedOnPath ? (
          <Link href={grantedOnPath} className="text-curtn-coral hover:underline font-medium">
            {ctx.grantedOnName ?? "Another unit"}
          </Link>
        ) : (
          <span className="font-medium">{ctx.grantedOnName ?? "Another unit"}</span>
        )}{" "}
        added <span className="font-medium">{ctx.recipientName ?? "your unit"}</span> as a trusted editor. Want to add them back?
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleAccept}
          disabled={accepted || fetching}
          className="rounded-md bg-curtn-coral px-3 py-1.5 text-xs font-medium text-curtn-deep hover:bg-curtn-red transition-colors disabled:opacity-50"
        >
          {accepted ? "Reciprocated" : fetching ? "Accepting…" : "Reciprocate"}
        </button>
        <Link href="/dashboard/trust" className="text-[11px] text-curtn-muted hover:text-curtn-cream">
          Customize first →
        </Link>
        {errorMsg && <span className="text-[11px] text-red-300">{errorMsg}</span>}
      </div>
    </div>
  );
}

export function NotificationCard({ notification }: { notification: NotificationData }) {
  const [{ fetching }, executeMarkRead] = useMutation(MARK_NOTIFICATION_READ_MUTATION);
  const [optimisticallyRead, setOptimisticallyRead] = useState(false);

  const isRead = !!notification.readAt || optimisticallyRead;

  async function handleMarkRead() {
    if (isRead || fetching) return;
    setOptimisticallyRead(true);
    const result = await executeMarkRead({ input: { notificationId: notification.id } });
    if (result.data?.markNotificationRead?.error) {
      setOptimisticallyRead(false);
    }
  }

  const isReciprocity = notification.kind === "reciprocity_offered";

  return (
    <div
      onClick={handleMarkRead}
      className={`rounded-lg border p-4 cursor-pointer transition-colors ${
        isRead
          ? "border-curtn-dark bg-curtn-surface/40"
          : "border-curtn-coral/30 bg-curtn-surface hover:bg-curtn-surface/70"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {isReciprocity ? (
            <ReciprocityOfferBody notification={notification} />
          ) : (
            renderBody(notification)
          )}
          <p className="mt-1 text-[11px] text-curtn-muted">{timeSince(notification.createdAt)}</p>
        </div>
        {!isRead && <span className="mt-1 h-2 w-2 rounded-full bg-curtn-coral shrink-0" />}
      </div>
    </div>
  );
}
