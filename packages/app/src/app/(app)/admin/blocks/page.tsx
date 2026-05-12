"use client";

import Link from "next/link";
import { useQuery } from "urql";
import { ADMIN_BLOCK_ACTIVITY_QUERY } from "@/lib/graphql/blocks";

// Phase 7 — admin block-activity dashboard. Aggregates over the trailing
// window (default 30 days) and surfaces:
//   - top blockers (claimants ranked by block count, threshold-flagged)
//   - recent blocks (the raw stream, scopedTo + reason + actors)
// Used in concert with the daily block-volume cron, which fires
// `high_block_volume_alert` notifications to every admin when any single
// claimant crosses BLOCK_VOLUME_ALERT_THRESHOLD blocks in the window.

const KIND_PATH_PREFIX: Record<string, string> = {
  Venue: "/venues",
  ProductionCompany: "/companies",
  Person: "/people",
};

function unitPath(kind: string, slug: string | null | undefined): string | null {
  const prefix = KIND_PATH_PREFIX[kind];
  if (!prefix || !slug) return null;
  return `${prefix}/${slug}`;
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdminBlocksPage() {
  const [{ data, fetching, error }] = useQuery({
    query: ADMIN_BLOCK_ACTIVITY_QUERY,
    variables: {},
  });

  const activity = data?.adminBlockActivity;

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-curtn-cream">Block activity</h1>
        <p className="text-sm text-curtn-muted">
          Last {activity?.windowDays ?? 30} days · flag threshold {activity?.threshold ?? 10}+ blocks per claimant
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {error.message}
        </div>
      )}

      {fetching && !activity ? (
        <div className="text-curtn-muted">Loading…</div>
      ) : !activity ? (
        <div className="rounded-lg border border-curtn-dark bg-curtn-surface/40 p-6 text-curtn-muted">
          Admin access required.
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-curtn-cream uppercase tracking-wide">Top blockers</h2>
            {activity.topBlockers.length === 0 ? (
              <p className="text-sm text-curtn-muted">No blocks in this window.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-curtn-dark">
                <table className="w-full text-sm">
                  <thead className="bg-curtn-surface/60 text-curtn-muted">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Claimant</th>
                      <th className="px-3 py-2 text-right font-medium">Blocks issued</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.topBlockers.map((b: any) => (
                      <tr key={b.blockerId} className="border-t border-curtn-dark/60">
                        <td className="px-3 py-2 text-curtn-cream">
                          {b.blockerUsername ? `@${b.blockerUsername}` : (b.blockerFullName ?? b.blockerId)}
                        </td>
                        <td className="px-3 py-2 text-right text-curtn-cream">{b.blockCount}</td>
                        <td className="px-3 py-2">
                          {b.flagged ? (
                            <span className="rounded-full bg-curtn-red/30 px-2 py-0.5 text-[11px] text-red-200">Flagged</span>
                          ) : (
                            <span className="text-curtn-muted text-[11px]">Within threshold</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-curtn-cream uppercase tracking-wide">Recent blocks</h2>
            {activity.recentBlocks.length === 0 ? (
              <p className="text-sm text-curtn-muted">No blocks in this window.</p>
            ) : (
              <ul className="space-y-2">
                {activity.recentBlocks.map((row: any) => {
                  const path = unitPath(row.scopedTo?.kind, row.scopedTo?.slug);
                  return (
                    <li key={row.id} className="rounded-lg border border-curtn-dark bg-curtn-surface/40 p-3">
                      <p className="text-sm text-curtn-cream">
                        <span className="font-medium">
                          {row.blocker?.username ? `@${row.blocker.username}` : (row.blocker?.fullName ?? "A claimant")}
                        </span>{" "}
                        blocked{" "}
                        <span className="font-medium">
                          {row.blockedUser?.username ? `@${row.blockedUser.username}` : (row.blockedUser?.fullName ?? "a user")}
                        </span>{" "}
                        on{" "}
                        {path ? (
                          <Link href={path} className="text-curtn-coral hover:underline">
                            {row.scopedTo?.name ?? "a unit"}
                          </Link>
                        ) : (
                          <span>{row.scopedTo?.name ?? "a unit"}</span>
                        )}
                      </p>
                      {row.reason && (
                        <p className="mt-1 text-xs text-curtn-muted italic">Reason: {row.reason}</p>
                      )}
                      <p className="mt-1 text-[11px] text-curtn-muted">
                        {timeSince(row.createdAt)}
                        {row.revokedAt ? " · revoked" : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
