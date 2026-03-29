"use client";

import { useState } from "react";
import Link from "next/link";
import { formatShowDate, formatShowTime } from "@/lib/format";
import { Icon } from "@/components/icons/Icons";

interface Showing {
  id?: string;
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
    <div>
      <h2 className="mb-3 text-xs uppercase tracking-widest text-curtn-muted">{label}</h2>

      <div className="space-y-2">
        {visible.map((showing, i) => {
          const isSoldOut = showing.soldOut === true || showing.soldOut === "true";
          const dateObj = new Date(showing.date);
          const day = dateObj.getDate().toString().padStart(2, "0");
          const month = dateObj.toLocaleString("en-US", { month: "short" });

          const cardContent = (
            <>
              <div className={`ticket-stub ${isSoldOut ? "!bg-curtn-muted" : ""}`}>
                <div className="ticket-date">{day}</div>
                <div className="ticket-month">{month}</div>
              </div>
              <div className="ticket-body">
                <div className="ticket-title text-curtn-cream">
                  {showing.venue?.name ?? "TBA"}
                </div>
                <div className="ticket-time">
                  {formatShowTime(showing.time)}
                  {isSoldOut && (
                    <span className="badge badge-muted ml-2">Sold Out</span>
                  )}
                  {!isSoldOut && showing.ticketUrl && (
                    <a
                      href={showing.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 ml-2 text-curtn-coral hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Icon name="ticket" size={12} />
                      Tickets
                    </a>
                  )}
                </div>
              </div>
              {showing.id && (
                <div className="flex items-center pr-3 text-curtn-muted/40 text-sm">
                  &rsaquo;
                </div>
              )}
            </>
          );

          if (showing.id) {
            return (
              <Link
                key={`${showing.date}-${i}`}
                href={`/showings/${encodeURIComponent(showing.id)}`}
                className="card-ticket transition-colors hover:border-curtn-muted/50"
              >
                {cardContent}
              </Link>
            );
          }

          return (
            <div key={`${showing.date}-${i}`} className="card-ticket">
              {cardContent}
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-xs text-curtn-coral hover:underline cursor-pointer"
        >
          {showAll ? "Show fewer" : `Show all ${showings.length} dates`}
        </button>
      )}
    </div>
  );
}
