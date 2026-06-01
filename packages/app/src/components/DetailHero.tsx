"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icons";
import { formatDuration, formatShowDate, formatShowTime } from "@/lib/format";

interface Creator {
  id: string;
  person: { id: string; name: string; slug: string };
  role: string;
  order?: number;
}

interface DetailHeroProps {
  title: string;
  description: string | null;
  performanceTypes: string[];
  duration: number;
  intermissions?: number | null;
  languages: string[] | null;
  imageUrl?: string | null;
  posterUrl?: string | null;
  creators?: Creator[];
  averageRating: number | null;
  reviewCount: number;
  totalAttendees?: number | null;
  onEdit?: () => void;
  entityType?: string;
  companyName?: string | null;
  companySlug?: string | null;
  venues?: { name: string; slug: string; city: string }[];
  startDate?: string | null;
  endDate?: string | null;
  performanceDate?: string | null;
  performanceTime?: string | null;
  ticketUrl?: string | null;
  soldOut?: boolean;
}

export function DetailHero({
  title,
  description,
  performanceTypes,
  duration,
  intermissions,
  languages,
  imageUrl,
  posterUrl,
  creators,
  averageRating,
  reviewCount,
  totalAttendees,
  onEdit,
  entityType = "Show",
  companyName,
  companySlug,
  venues = [],
  startDate,
  endDate,
  performanceDate,
  performanceTime,
  ticketUrl,
  soldOut,
}: DetailHeroProps) {
  const [expanded, setExpanded] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [backdropFailed, setBackdropFailed] = useState(false);

  const effectivePoster = posterFailed ? null : posterUrl;
  const effectiveImage = backdropFailed ? null : imageUrl;
  const hasHeroMedia = !!(effectiveImage || effectivePoster);

  const metaParts: string[] = [];
  // Only show runtime/intermission when we actually know the duration —
  // don't fabricate "0m" or assert "No intermission" for a metadata-less show.
  if (duration > 0) {
    metaParts.push(formatDuration(duration));
    if (intermissions === 0) metaParts.push("No intermission");
    else if (intermissions && intermissions > 0)
      metaParts.push(`${intermissions} intermission${intermissions > 1 ? "s" : ""}`);
  }
  if (languages && languages.length > 0) metaParts.push(languages.join(", "));

  const dateRange = (() => {
    if (!startDate) return null;
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (!endDate || startDate === endDate) return fmt(startDate);
    return `${fmt(startDate)} – ${fmt(endDate)}`;
  })();

  return (
    <div>
      {hasHeroMedia ? (
        <div className="relative -mx-6 -mt-8 mb-6 z-0">
          {/* Backdrop */}
          <div className="relative h-[280px] sm:h-[400px] overflow-hidden">
            {effectiveImage && effectivePoster ? (
              <img
                src={effectiveImage}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setBackdropFailed(true)}
              />
            ) : (
              <div className="h-full w-full bg-curtn-surface" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-curtn-deep via-curtn-deep/60 to-curtn-deep/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-curtn-deep/80 to-transparent" />
          </div>

          {/* Poster + title overlay */}
          <div className="relative z-10 -mt-28 sm:-mt-36 px-6 flex flex-col sm:flex-row sm:gap-5 sm:items-end">
            <div className="w-[140px] shrink-0">
              <div className="relative aspect-[2/3] rounded-sm border-2 border-curtn-dark/50 bg-curtn-surface shadow-2xl overflow-hidden">
                <img
                  src={(effectivePoster || effectiveImage)!}
                  alt={title}
                  className="h-full w-full object-cover"
                  onError={() => setPosterFailed(true)}
                />
              </div>
            </div>
            <div className="flex-1 min-w-0 mt-4 sm:mt-0 sm:pb-1">
              {performanceTypes.length > 0 && (
                <div className="-ml-2.5 mb-2 flex flex-wrap gap-1.5">
                  {performanceTypes.map((type) => (
                    <span
                      key={type}
                      className="bg-curtn-deep/60 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold text-curtn-cream leading-tight normal-case break-words">
                {title}
              </h1>
            </div>
          </div>
        </div>
      ) : (
        <>
          {performanceTypes.length > 0 && (
            <div className="-ml-2.5 mb-3 flex flex-wrap gap-1.5">
              {performanceTypes.map((type) => (
                <span
                  key={type}
                  className="bg-curtn-dark/60 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted"
                >
                  {type}
                </span>
              ))}
            </div>
          )}

          <h1 className="text-2xl font-bold text-curtn-cream leading-tight normal-case">{title}</h1>
        </>
      )}

      <div className="relative z-10">
        {description && (
          <div className="mt-4">
            <p
              className={`text-sm text-curtn-cream/80 leading-relaxed ${
                !expanded ? "line-clamp-4" : ""
              }`}
            >
              {description}
            </p>
            {description.length > 200 && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="mt-1 text-xs text-curtn-coral hover:underline"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}

        {/* Record panel */}
        <div className="mt-6 dinn-panel">
          <div className="dinn-header">
            <span className="dinn-title">Record of {entityType}</span>
            <span className="dinn-ref flex items-center gap-2">
              {(averageRating !== null || reviewCount > 0) && (
                <span className="flex items-center gap-1">
                  <Icon name="star" weight="fill" size={12} className="text-curtn-coral" />
                  {averageRating !== null ? averageRating.toFixed(1) : "—"}
                  <span className="text-curtn-muted/50">({reviewCount})</span>
                </span>
              )}
              {totalAttendees != null && totalAttendees > 0 && (
                <span className="flex items-center gap-1 text-curtn-muted/50">
                  <Icon name="eye" weight="regular" size={12} />
                  {totalAttendees}
                </span>
              )}
            </span>
          </div>
          <div className="dinn-grid">
            {performanceDate && (
              <>
                <span className="dinn-label">Date</span>
                <span className="dinn-value">
                  {formatShowDate(performanceDate)}
                  {performanceTime && (
                    <span className="text-curtn-muted/60"> · {formatShowTime(performanceTime)}</span>
                  )}
                  {soldOut && (
                    <span className="text-curtn-red ml-2 text-[10px] uppercase">Sold Out</span>
                  )}
                </span>
              </>
            )}
            {dateRange && !performanceDate && (
              <>
                <span className="dinn-label">Dates</span>
                <span className="dinn-value">{dateRange}</span>
              </>
            )}
            {venues.length > 0 && (
              <>
                <span className="dinn-label">Venue</span>
                <span className="dinn-value">
                  {venues.map((v, i) => (
                    <span key={v.slug}>
                      {i > 0 && ", "}
                      <Link href={`/venues/${v.slug}`} className="text-curtn-coral hover:underline">
                        {v.name}
                      </Link>
                      <span className="text-curtn-muted/60">, {v.city}</span>
                    </span>
                  ))}
                </span>
              </>
            )}
            {performanceTypes.length > 0 && (
              <>
                <span className="dinn-label">Type</span>
                <span className="dinn-value capitalize">{performanceTypes.join(", ")}</span>
              </>
            )}
            {metaParts.length > 0 && (
              <>
                <span className="dinn-label">Duration</span>
                <span className="dinn-value">{metaParts.join(" · ")}</span>
              </>
            )}
            {companyName && (
              <>
                <span className="dinn-label">Company</span>
                <span className="dinn-value">
                  <Link href={`/companies/${companySlug}`} className="text-curtn-coral hover:underline">
                    {companyName}
                  </Link>
                </span>
              </>
            )}
            {creators && creators.length > 0 && (
              <>
                <span className="dinn-label">Creators</span>
                <span className="dinn-value">
                  {creators.map((c, i) => (
                    <span key={c.id}>
                      {i > 0 && ", "}
                      <Link href={`/people/${c.person.slug}`} className="text-curtn-coral hover:underline">
                        {c.person.name}
                      </Link>
                      <span className="text-curtn-muted/50"> ({c.role})</span>
                    </span>
                  ))}
                </span>
              </>
            )}
            {!soldOut && ticketUrl && (
              <>
                <span className="dinn-label">Tickets</span>
                <span className="dinn-value">
                  <a
                    href={ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-curtn-coral hover:underline inline-flex items-center gap-1"
                  >
                    <Icon name="ticket" size={12} />
                    Buy tickets
                  </a>
                </span>
              </>
            )}
          </div>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="mt-3 pt-3 border-t border-curtn-dark/30 flex items-center gap-1.5 text-xs text-curtn-muted hover:text-curtn-coral transition-colors cursor-pointer w-full"
            >
              <Icon name="pencil" size={12} />
              Edit details
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
