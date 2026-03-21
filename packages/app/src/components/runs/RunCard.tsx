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
  imageUrl?: string | null;
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
  imageUrl,
}: RunCardProps) {
  const dateRange = formatDateRange(startDate, endDate);

  return (
    <Link
      href={`/runs/${id}`}
      className="group flex gap-[var(--spacing-2)] dog-ear border border-curtn-dark/50 bg-curtn-surface overflow-hidden p-[var(--spacing-2)] transition-colors duration-200 hover:border-curtn-muted/50"
    >
      {/* Poster thumbnail */}
      <div className="w-[var(--spacing-9)] shrink-0">
        <div className="aspect-[2/3] overflow-hidden dog-ear bg-curtn-dark/30 border border-curtn-dark/50">
          {imageUrl ? (
            <img src={imageUrl} alt={showTitle} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Icon name="ticket" weight="thin" size={20} className="text-curtn-dark" />
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {performanceTypes && performanceTypes.length > 0 && (
          <div className="mb-[var(--spacing-0_5)] flex flex-wrap gap-1">
            {performanceTypes.map((type) => (
              <span
                key={type}
                className="bg-curtn-dark/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted"
              >
                {type}
              </span>
            ))}
          </div>
        )}

        <h3 className="text-sm font-semibold text-curtn-cream line-clamp-2 leading-snug">
          {showTitle}
        </h3>

        {companyName && (
          <p className="mt-[var(--spacing-0_5)] text-xs text-curtn-muted truncate">by {companyName}</p>
        )}

        {(venueName || dateRange) && (
          <div className="mt-[var(--spacing-0_5)] flex flex-col gap-0.5 text-xs text-curtn-muted/70">
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
          <div className="mt-[var(--spacing-0_5)] flex items-center gap-1 text-xs text-curtn-muted">
            <Icon name="star" weight="fill" size={12} className="text-curtn-coral" />
            <span>
              {averageRating !== null ? averageRating.toFixed(1) : "\u2014"}
              <span className="ml-1 text-curtn-muted/70">
                · {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
              </span>
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
