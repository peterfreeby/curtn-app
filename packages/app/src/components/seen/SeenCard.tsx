"use client";

import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ShowThumb } from "@/components/ShowThumb";

interface SeenCardProps {
  seen: {
    id: string;
    createdAt?: string | null;
    user?: { id: string; username: string; fullName?: string; avatarUrl?: string | null } | null;
    run?: {
      id: string;
      startDate?: string | null;
      endDate?: string | null;
      show: {
        id: string;
        title: string;
        imageUrl?: string | null;
        posterUrl?: string | null;
      };
      venues?: { name: string; city?: string }[];
    } | null;
  };
  showUser?: boolean;
}

function formatDateRange(startDate?: string | null, endDate?: string | null): string {
  if (!startDate) return "";
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  const startYear = start.getFullYear();

  if (!end || start.toISOString().slice(0, 10) === end.toISOString().slice(0, 10)) {
    return start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  if (startYear === end.getFullYear()) {
    return `${start.toLocaleDateString("en-US", { month: "short" })}–${end.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
  }

  return `${startYear}–${end.getFullYear()}`;
}

export function SeenCard({ seen, showUser = false }: SeenCardProps) {
  const run = seen.run;
  if (!run) return null;

  const showTitle = run.show.title;
  const showImageUrl = run.show.posterUrl;
  const dateRange = formatDateRange(run.startDate, run.endDate);
  const venueName = run.venues?.[0]?.name;
  const userName = seen.user?.fullName || seen.user?.username || "Someone";

  const dateStr = seen.createdAt
    ? new Date(seen.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div className="border-b border-curtn-dark/40 py-3">
      {/* User line (feed context) */}
      {showUser && seen.user && (
        <div className="flex items-center gap-2 mb-2">
          <Avatar
            src={seen.user.avatarUrl}
            name={userName}
            size="sm"
          />
          <Link
            href={`/u/${encodeURIComponent(seen.user.username)}`}
            className="text-sm text-curtn-cream font-medium hover:text-curtn-coral transition-colors"
          >
            {userName}
          </Link>
          <span className="text-xs text-curtn-muted">logged</span>
          <span className="text-xs text-curtn-muted/40 ml-auto">{dateStr}</span>
        </div>
      )}

      {/* Show info */}
      <div className="flex items-center gap-2">
        <Link href={`/runs/${encodeURIComponent(run.id)}`}>
          <ShowThumb imageUrl={showImageUrl} title={showTitle} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/runs/${encodeURIComponent(run.id)}`}
            className="text-sm font-medium text-curtn-cream hover:text-curtn-coral transition-colors truncate block"
          >
            {showTitle}
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-curtn-muted mt-0.5">
            {dateRange && <span>{dateRange}</span>}
            {dateRange && venueName && <span>·</span>}
            {venueName && <span>{venueName}</span>}
          </div>
        </div>
        {!showUser && (
          <span className="text-[10px] uppercase tracking-widest text-curtn-muted/50 shrink-0">
            Seen
          </span>
        )}
      </div>
    </div>
  );
}
