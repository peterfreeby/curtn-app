"use client";

import { useState } from "react";
import { formatShowDate, formatShowTime } from "@/lib/format";
import { Icon } from "@/components/icons/Icons";

interface Showing {
  date: string;
  time: string;
  venue: { id: string; name: string } | null;
  ticketUrl: string | null;
  soldOut: boolean | string | null;
}

interface ShowingsListProps {
  showings: Showing[];
  label: string;
}

const INITIAL_COUNT = 5;

export function ShowingsList({ showings, label }: ShowingsListProps) {
  const [showAll, setShowAll] = useState(false);

  if (showings.length === 0) return null;

  const visible = showAll ? showings : showings.slice(0, INITIAL_COUNT);
  const hasMore = showings.length > INITIAL_COUNT;

  return (
    <div className="rounded-lg border border-curtn-dark/50 bg-curtn-surface p-4">
      <h2 className="mb-3 text-xs uppercase tracking-widest text-curtn-muted">{label}</h2>

      <div className="divide-y divide-curtn-dark/50">
        {visible.map((showing, i) => {
          const isSoldOut = showing.soldOut === true || showing.soldOut === "true";
          return (
            <div
              key={`${showing.date}-${i}`}
              className="flex items-center gap-3 py-2.5 text-sm"
            >
              <span className="w-24 shrink-0 text-curtn-cream">
                {formatShowDate(showing.date)}
              </span>
              <span className="min-w-0 flex-1 truncate text-curtn-muted">
                {showing.venue?.name ?? "TBA"}
              </span>
              <span className="shrink-0 text-curtn-muted/70">
                {formatShowTime(showing.time)}
              </span>
              <span className="shrink-0">
                {isSoldOut ? (
                  <span className="text-xs text-curtn-muted/50">Sold Out</span>
                ) : showing.ticketUrl ? (
                  <a
                    href={showing.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-curtn-coral/30 px-2.5 py-0.5 text-xs text-curtn-coral transition-colors hover:bg-curtn-coral/10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Icon name="ticket" size={12} />
                    Tickets
                  </a>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-xs text-curtn-coral hover:underline"
        >
          {showAll ? "Show fewer" : `Show all ${showings.length} dates`}
        </button>
      )}
    </div>
  );
}
