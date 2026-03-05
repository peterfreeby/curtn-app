"use client";

import Link from "next/link";
import { Icon } from "@/components/icons/Icons";

interface RunCardProps {
  id: string;
  showTitle: string;
  performanceTypes?: string[];
  companyName?: string | null;
  companySlug?: string | null;
  venueName?: string;
  venueCity?: string;
  startDate?: string | null;
  endDate?: string | null;
  averageRating: number | null;
  reviewCount: number;
}

function formatDateRange(start?: string | null, end?: string | null): string | null {
  if (!start) return null;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (!end || start === end) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

export function RunCard({
  id,
  showTitle,
  performanceTypes,
  companyName,
  companySlug,
  venueName,
  venueCity,
  startDate,
  endDate,
  averageRating,
  reviewCount,
}: RunCardProps) {
  const dateRange = formatDateRange(startDate, endDate);

  return (
    <Link
      href={`/runs/${id}`}
      className="block rounded-lg border border-curtn-dark/50 bg-curtn-surface p-4 transition-colors duration-200 hover:border-curtn-muted/50"
    >
      {performanceTypes && performanceTypes.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {performanceTypes.map((type) => (
            <span
              key={type}
              className="rounded-full bg-curtn-dark/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted"
            >
              {type}
            </span>
          ))}
        </div>
      )}

      <h3 className="text-base font-semibold text-curtn-cream line-clamp-2 leading-snug">
        {showTitle}
      </h3>

      {companyName && (
        <p className="mt-1 text-sm text-curtn-muted truncate">by {companyName}</p>
      )}

      {(venueName || dateRange) && (
        <div className="mt-2 flex flex-col gap-0.5 text-xs text-curtn-muted/70">
          {venueName && (
            <span className="flex items-center gap-1">
              <Icon name="map-pin" size={12} />
              {venueName}{venueCity ? `, ${venueCity}` : ""}
            </span>
          )}
          {dateRange && (
            <span className="flex items-center gap-1">
              <Icon name="calendar" size={12} />
              {dateRange}
            </span>
          )}
        </div>
      )}

      {(averageRating !== null || reviewCount > 0) && (
        <div className="mt-2 flex items-center gap-1 text-sm text-curtn-muted">
          <Icon name="star" weight="fill" size={14} className="text-curtn-coral" />
          <span>
            {averageRating !== null ? averageRating.toFixed(1) : "\u2014"}
            <span className="ml-1 text-curtn-muted/70">
              · {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
            </span>
          </span>
        </div>
      )}
    </Link>
  );
}
