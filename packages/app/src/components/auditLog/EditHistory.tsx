"use client";

import { useState } from "react";
import { useQuery, useMutation } from "urql";
import { useAuth } from "@/lib/auth/useAuth";
import {
  AUDIT_LOG_QUERY,
  REVERT_AUDIT_LOG_ENTRY_MUTATION,
  SUBMIT_REMOVAL_REQUEST_MUTATION,
} from "@/lib/graphql/auditLog";

// Public edit history viewer. Collapsed by default — clicking the header
// expands and fires the query. Each row shows attribution + a diff
// summary + revert + request-removal actions when applicable.
//
// Non-admins see hidden rows as placeholders (the server suppresses the
// diff payload via `_hidden: true`); admins see the original content.

type Kind = "Venue" | "ProductionCompany" | "Person" | "Show" | "Run" | "Performance" | "Stage";

interface EditHistoryProps {
  targetKind: Kind;
  targetId: string;
  // Whether the current viewer has edit rights on the target. Controls the
  // revert button. Defaults to false — parent page should pass true when
  // the viewer is admin or the claimant.
  canEdit?: boolean;
}

interface AuthorNode {
  kind: string;
  label: string | null;
  user: { id: string; username: string; fullName: string; avatarUrl: string } | null;
}

interface EntryNode {
  id: string;
  target: { kind: string; targetId: string };
  author: AuthorNode;
  diffJson: string;
  approvalSource: string;
  approvalContextJson: string;
  isRevert: string;
  revertOf: string | null;
  hidden: string;
  createdAt: string;
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function authorLabel(a: AuthorNode): string {
  if (a.kind === "User") {
    return a.user?.username ? `@${a.user.username}` : a.user?.fullName || "Someone";
  }
  if (a.kind === "Scraper") return a.label || "Scraper";
  if (a.kind === "SyncFeed") return a.label || "Sync feed";
  return a.label || a.kind;
}

function describeDiff(diffJson: string): { lines: string[]; created: boolean; hidden: boolean } {
  let diff: any = {};
  try {
    diff = JSON.parse(diffJson || "{}");
  } catch {
    return { lines: ["(unparseable diff)"], created: false, hidden: false };
  }
  if (diff._hidden) return { lines: [], created: false, hidden: true };
  if (diff._created) return { lines: ["created record"], created: true, hidden: false };

  const lines: string[] = [];
  for (const key of Object.keys(diff)) {
    const entry = diff[key];
    if (entry && typeof entry === "object" && "old" in entry && "new" in entry) {
      const oldStr = formatValue(entry.old);
      const newStr = formatValue(entry.new);
      lines.push(`${key}: ${oldStr} → ${newStr}`);
    }
  }
  if (lines.length === 0) lines.push("(no field changes)");
  return { lines, created: false, hidden: false };
}

function formatValue(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") {
    if (v.length > 80) return `"${v.slice(0, 77)}…"`;
    return `"${v}"`;
  }
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (typeof v === "object") return "{…}";
  return String(v);
}

export function EditHistory({ targetKind, targetId, canEdit = false }: EditHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const [showRemovalForm, setShowRemovalForm] = useState<string | null>(null);

  const [{ data, fetching, error }, refetch] = useQuery({
    query: AUDIT_LOG_QUERY,
    variables: { targetKind, targetId, first: 20 },
    pause: !expanded,
  });

  const [, revert] = useMutation(REVERT_AUDIT_LOG_ENTRY_MUTATION);

  async function handleRevert(entryId: string) {
    if (!confirm("Revert this edit? A new entry will be added to the history.")) return;
    const result = await revert({ input: { auditLogEntryId: entryId } });
    if (result.data?.revertAuditLogEntry?.error) {
      alert(result.data.revertAuditLogEntry.error);
      return;
    }
    refetch({ requestPolicy: "network-only" });
  }

  const edges = data?.auditLog?.edges || [];

  return (
    <section className="rounded-lg border border-curtn-dark bg-curtn-surface/40">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-curtn-surface/70 transition rounded-lg"
      >
        <span className="text-sm font-medium text-curtn-cream">Edit history</span>
        <span className="text-xs text-curtn-muted">{expanded ? "Hide" : "Show"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {fetching && <p className="text-xs text-curtn-muted">Loading…</p>}
          {error && <p className="text-xs text-curtn-coral">Failed to load history.</p>}
          {!fetching && edges.length === 0 && (
            <p className="text-xs text-curtn-muted">No edit history yet. Edits made after May 2026 appear here.</p>
          )}
          {edges.map(({ node }: { node: EntryNode }) => {
            const desc = describeDiff(node.diffJson);
            const isHidden = node.hidden === "true";
            const isRevert = node.isRevert === "true";

            return (
              <div key={node.id} className="rounded border border-curtn-dark/60 bg-curtn-deep/40 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-curtn-cream">
                    <span className="font-medium">{authorLabel(node.author)}</span>
                    {isRevert && <span className="ml-2 inline-block rounded bg-curtn-coral/20 px-1.5 py-0.5 text-curtn-coral text-[10px]">revert</span>}
                  </div>
                  <span className="text-curtn-muted">{timeSince(node.createdAt)}</span>
                </div>

                {isHidden ? (
                  <p className="text-curtn-muted italic">[hidden by Curtn admin]</p>
                ) : (
                  <ul className="space-y-1 text-curtn-cream/80">
                    {desc.lines.map((line, i) => (
                      <li key={i} className="font-mono text-[11px] break-all">{line}</li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center gap-3 pt-1">
                  {canEdit && !isHidden && !desc.created && (
                    <button
                      type="button"
                      onClick={() => handleRevert(node.id)}
                      className="text-curtn-coral hover:underline text-[11px]"
                    >
                      Revert
                    </button>
                  )}
                  {!isHidden && (
                    <button
                      type="button"
                      onClick={() => setShowRemovalForm(showRemovalForm === node.id ? null : node.id)}
                      className="text-curtn-muted hover:text-curtn-cream text-[11px]"
                    >
                      Request removal
                    </button>
                  )}
                </div>

                {showRemovalForm === node.id && (
                  <RemovalRequestForm
                    entryId={node.id}
                    onDone={() => setShowRemovalForm(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RemovalRequestForm({ entryId, onDone }: { entryId: string; onDone: () => void }) {
  const { user } = useAuth();
  const [category, setCategory] = useState("privacy");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [, submit] = useMutation(SUBMIT_REMOVAL_REQUEST_MUTATION);

  if (!user) {
    return <p className="text-curtn-muted text-[11px]">Sign in to request removal.</p>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) return;
    setSubmitting(true);
    const result = await submit({
      input: { auditLogEntryId: entryId, reason: reason.trim(), category },
    });
    setSubmitting(false);
    if (result.data?.submitRemovalRequest?.error) {
      alert(result.data.submitRemovalRequest.error);
      return;
    }
    alert("Removal request submitted. An admin will review.");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 pt-2 border-t border-curtn-dark/60">
      <select
        value={category}
        onChange={e => setCategory(e.target.value)}
        className="w-full bg-curtn-dark text-curtn-cream text-[11px] rounded px-2 py-1"
      >
        <option value="deadname">Deadname</option>
        <option value="harassment">Harassment</option>
        <option value="copyright">Copyright</option>
        <option value="privacy">Privacy</option>
        <option value="other">Other</option>
      </select>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Why should this be hidden?"
        className="w-full bg-curtn-dark text-curtn-cream text-[11px] rounded px-2 py-1 min-h-[60px]"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || reason.trim().length < 3}
          className="text-curtn-coral hover:underline text-[11px] disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
        <button type="button" onClick={onDone} className="text-curtn-muted text-[11px]">
          Cancel
        </button>
      </div>
    </form>
  );
}
