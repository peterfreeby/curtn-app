"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "urql";
import {
  MY_GRANTED_TRUSTED_EDITORS_QUERY,
  MY_RECEIVED_TRUSTED_EDITORS_QUERY,
  REVOKE_TRUSTED_EDITOR_MUTATION,
  UPDATE_TRUSTED_EDITOR_SCOPE_MUTATION,
  ACTION_CATALOG,
  ROLE_TEMPLATES,
} from "@/lib/graphql/trust";
import { useAuth } from "@/lib/auth/useAuth";

// Phase 5 — trust management dashboard. Two sections:
//   1) Editors trusted on your units — grants you've made; per-row scope editor + revoke
//   2) Units that trust you — grants where you're the recipient (read-only)

interface TrustedEditorRow {
  id: string;
  scope: string[];
  roleTemplate: string;
  grantedAt: string;
  revokedAt: string | null;
  grantedOn: { kind: string; targetId: string; name: string | null; slug: string | null };
  recipient: { kind: string; targetId: string; name: string | null; slug: string | null };
}

const TARGET_PATH_PREFIX: Record<string, string> = {
  Venue: "/venues",
  ProductionCompany: "/companies",
  Person: "/people",
};

function decodeId(globalId: string): string {
  try { return atob(globalId).split(":")[1]; } catch { return globalId; }
}

function recipientLabel(r: TrustedEditorRow["recipient"]): string {
  if (r.kind === "User") return r.name ? `@${r.name}` : "(user)";
  return r.name ?? `(${r.kind})`;
}

function groupActionsByEntity(scope: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const a of scope) {
    const spec = ACTION_CATALOG[a];
    const group = spec?.targetType ?? "Other";
    (out[group] ??= []).push(a);
  }
  return out;
}

export default function TrustDashboardPage() {
  const { user } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScope, setEditScope] = useState<Set<string>>(new Set());
  const [editTemplate, setEditTemplate] = useState<string>("Custom");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [{ data: grantedData, fetching: grantedFetching }, refetchGranted] = useQuery({
    query: MY_GRANTED_TRUSTED_EDITORS_QUERY,
    variables: { includeRevoked: false },
    pause: !user,
  });
  const [{ data: receivedData, fetching: receivedFetching }] = useQuery({
    query: MY_RECEIVED_TRUSTED_EDITORS_QUERY,
    variables: { includeRevoked: false },
    pause: !user,
  });

  const [, executeRevoke] = useMutation(REVOKE_TRUSTED_EDITOR_MUTATION);
  const [, executeUpdate] = useMutation(UPDATE_TRUSTED_EDITOR_SCOPE_MUTATION);

  if (!user) {
    return (
      <div className="px-6 py-12 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-curtn-cream">Sign in to manage trust</h1>
        <Link href="/login" className="mt-4 inline-block text-sm text-curtn-coral hover:underline">
          Sign in →
        </Link>
      </div>
    );
  }

  const granted: TrustedEditorRow[] = grantedData?.myGrantedTrustedEditors ?? [];
  const received: TrustedEditorRow[] = receivedData?.myReceivedTrustedEditors ?? [];

  function startEdit(row: TrustedEditorRow) {
    setEditingId(row.id);
    setEditScope(new Set(row.scope));
    setEditTemplate(row.roleTemplate);
    setStatusMessage(null);
  }

  function applyTemplate(template: string) {
    setEditTemplate(template);
    if (template === "Custom") return;
    const tplActions = ROLE_TEMPLATES[template] ?? [];
    setEditScope(new Set(tplActions));
  }

  function toggleAction(action: string) {
    setEditScope(prev => {
      const next = new Set(prev);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
    setEditTemplate("Custom");
  }

  async function handleSaveScope(row: TrustedEditorRow) {
    setStatusMessage(null);
    const res = await executeUpdate({
      input: {
        trustedEditorId: decodeId(row.id),
        scope: [...editScope],
        roleTemplate: editTemplate,
      },
    });
    const payload = res.data?.updateTrustedEditorScope;
    if (payload?.error) { setStatusMessage(payload.error); return; }
    setEditingId(null);
    refetchGranted({ requestPolicy: "network-only" });
  }

  async function handleRevoke(row: TrustedEditorRow) {
    setStatusMessage(null);
    const res = await executeRevoke({
      input: { trustedEditorId: decodeId(row.id) },
    });
    const payload = res.data?.revokeTrustedEditor;
    if (payload?.error) { setStatusMessage(payload.error); return; }
    setStatusMessage("Trust revoked.");
    refetchGranted({ requestPolicy: "network-only" });
  }

  const loading = grantedFetching || receivedFetching;

  return (
    <div className="px-2 sm:px-6 py-8 max-w-3xl mx-auto space-y-10">
      <div>
        <h1 className="text-xl font-bold text-curtn-cream">Trusted editors</h1>
        <p className="mt-1 text-sm text-curtn-muted">
          Auto-approve future edits from people you trust. Grants are directional and revocable.
        </p>
        <Link href="/dashboard" className="mt-2 inline-block text-xs text-curtn-muted hover:text-curtn-cream">
          ← Back to dashboard
        </Link>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-curtn-dark bg-curtn-surface px-4 py-3 text-sm text-curtn-cream">
          {statusMessage}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
        </div>
      )}

      {/* Editors you trust */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-curtn-coral">Editors trusted on your units</h2>
        {granted.length === 0 ? (
          <div className="rounded-lg border border-curtn-dark bg-curtn-surface px-6 py-10 text-center">
            <p className="text-sm text-curtn-muted">
              You haven't granted trust to anyone yet. When you approve a proposal, toggle "Auto-approve future edits" to start.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {granted.map((row) => {
              const isEditing = editingId === row.id;
              const grantedOnPath = row.grantedOn.slug && TARGET_PATH_PREFIX[row.grantedOn.kind]
                ? `${TARGET_PATH_PREFIX[row.grantedOn.kind]}/${row.grantedOn.slug}`
                : null;
              return (
                <div key={row.id} className="rounded-lg border border-curtn-dark bg-curtn-surface">
                  <div className="p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-curtn-cream font-medium">{recipientLabel(row.recipient)}</span>
                        <span className="text-curtn-muted">on</span>
                        {grantedOnPath ? (
                          <Link href={grantedOnPath} className="text-curtn-coral hover:underline font-medium">
                            {row.grantedOn.name ?? "(unknown)"}
                          </Link>
                        ) : (
                          <span className="text-curtn-cream font-medium">{row.grantedOn.name ?? "(unknown)"}</span>
                        )}
                        <span className="text-curtn-muted">·</span>
                        <span className="inline-block rounded-full bg-curtn-deep px-2 py-0.5 uppercase tracking-wider text-curtn-muted text-[10px]">
                          {row.roleTemplate}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => isEditing ? setEditingId(null) : startEdit(row)}
                          className="text-[11px] text-curtn-muted hover:text-curtn-cream"
                        >
                          {isEditing ? "Cancel" : "Edit scope"}
                        </button>
                        <button
                          onClick={() => handleRevoke(row)}
                          className="text-[11px] text-red-300 hover:text-red-400"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-curtn-muted">
                      {row.scope.length} action{row.scope.length === 1 ? "" : "s"} in scope
                    </p>
                  </div>

                  {isEditing && (
                    <div className="border-t border-curtn-dark p-4 space-y-3 bg-curtn-deep/40">
                      <div className="flex flex-wrap gap-2">
                        {(["Manager", "Booker", "Publicist", "Personal", "Custom"] as const).map(tpl => (
                          <button
                            key={tpl}
                            onClick={() => applyTemplate(tpl)}
                            className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${
                              editTemplate === tpl
                                ? "bg-curtn-coral text-curtn-deep font-medium"
                                : "bg-curtn-dark text-curtn-muted hover:text-curtn-cream"
                            }`}
                          >
                            {tpl}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-3">
                        {Object.entries(
                          Object.keys(ACTION_CATALOG).reduce<Record<string, string[]>>((acc, action) => {
                            const group = ACTION_CATALOG[action].targetType;
                            (acc[group] ??= []).push(action);
                            return acc;
                          }, {})
                        ).map(([group, actions]) => (
                          <div key={group}>
                            <p className="text-[10px] uppercase tracking-widest text-curtn-muted mb-1">{group}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {actions.map(action => (
                                <label key={action} className="flex items-center gap-2 text-[11px] text-curtn-cream cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editScope.has(action)}
                                    onChange={() => toggleAction(action)}
                                    className="accent-curtn-coral"
                                  />
                                  <span>{ACTION_CATALOG[action].description}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveScope(row)}
                          className="rounded-md bg-curtn-coral px-3 py-1.5 text-xs font-bold text-curtn-deep hover:bg-curtn-red transition-colors"
                        >
                          Save scope
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Units that trust you */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-curtn-muted">Units that trust you</h2>
        {received.length === 0 ? (
          <div className="rounded-lg border border-curtn-dark bg-curtn-surface/40 px-6 py-8 text-center">
            <p className="text-sm text-curtn-muted">
              No one has granted you trusted-editor access yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {received.map((row) => {
              const grantedOnPath = row.grantedOn.slug && TARGET_PATH_PREFIX[row.grantedOn.kind]
                ? `${TARGET_PATH_PREFIX[row.grantedOn.kind]}/${row.grantedOn.slug}`
                : null;
              return (
                <div key={row.id} className="rounded-lg border border-curtn-dark bg-curtn-surface/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-curtn-muted">You can edit</span>
                      {grantedOnPath ? (
                        <Link href={grantedOnPath} className="text-curtn-coral hover:underline font-medium">
                          {row.grantedOn.name ?? "(unknown)"}
                        </Link>
                      ) : (
                        <span className="text-curtn-cream font-medium">{row.grantedOn.name ?? "(unknown)"}</span>
                      )}
                      <span className="inline-block rounded-full bg-curtn-deep px-2 py-0.5 uppercase tracking-wider text-curtn-muted text-[10px]">
                        {row.roleTemplate}
                      </span>
                    </div>
                    <p className="text-[11px] text-curtn-muted">
                      {row.scope.length} action{row.scope.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
