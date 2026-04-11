"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getRecentLog, clearRecentLog, type RecentLog } from "@/lib/recentLog";
import { StarRating } from "@/components/StarRating";

export function RecentlyLogged() {
  const [recent, setRecent] = useState<RecentLog | null>(null);

  useEffect(() => {
    setRecent(getRecentLog());
  }, []);

  if (!recent) return null;

  const minutesAgo = Math.round((Date.now() - recent.timestamp) / 60000);
  const timeLabel =
    minutesAgo < 1
      ? "Just now"
      : minutesAgo < 60
        ? `${minutesAgo}m ago`
        : "Recently";

  return (
    <div className="max-w-lg mx-auto mb-6">
      <div className="border border-curtn-dark/50 bg-curtn-surface/50 px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-curtn-muted mb-1">{timeLabel}</p>
          <p className="text-sm text-curtn-cream font-medium truncate">
            {recent.showTitle}
            {recent.venueName && (
              <span className="text-curtn-muted font-normal">
                {" "}at {recent.venueName}
              </span>
            )}
          </p>
          <StarRating value={recent.rating} size={12} readOnly />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`/runs/${encodeURIComponent(recent.runId)}`}
            className="text-xs font-medium text-curtn-coral hover:text-curtn-red transition-colors whitespace-nowrap"
          >
            Edit details
          </Link>
          <button
            type="button"
            onClick={() => {
              clearRecentLog();
              setRecent(null);
            }}
            className="text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer text-sm"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      </div>
    </div>
  );
}
