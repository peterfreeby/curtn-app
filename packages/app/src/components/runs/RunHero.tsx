"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icons";
import { formatDuration, formatShowDate, formatShowTime } from "@/lib/format";

interface Creator {
  id: string;
  person: { id: string; name: string; slug: string };
  role: string;
}

interface RunHeroProps {
  showTitle: string;
  showId: string;
  description: string | null;
  showDescription: string;
  performanceTypes: string[];
  duration: number;
  intermissions: number | null;
  languages: string[] | null;
  imageUrl?: string | null;
  posterUrl?: string | null;
  creators?: Creator[];
  companyName?: string | null;
  companySlug?: string | null;
  venues: { name: string; slug: string; city: string }[];
  startDate: string | null;
  endDate: string | null;
  averageRating: number | null;
  reviewCount: number;
  /** Scenario A: single-performance metadata merged into hero */
  performanceDate?: string | null;
  performanceTime?: string | null;
  ticketUrl?: string | null;
  soldOut?: boolean;
}

export function RunHero({
  showTitle,
  showId,
  description,
  showDescription,
  performanceTypes,
  duration,
  intermissions,
  languages,
  imageUrl,
  posterUrl,
  creators,
  companyName,
  companySlug,
  venues,
  startDate,
  endDate,
  averageRating,
  reviewCount,
  performanceDate,
  performanceTime,
  ticketUrl,
  soldOut,
}: RunHeroProps) {
  const [expanded, setExpanded] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [backdropFailed, setBackdropFailed] = useState(false);
  const effectivePoster = posterFailed ? null : posterUrl;
  const effectiveImage = backdropFailed ? null : imageUrl;
  const hasHeroMedia = !!(effectiveImage || effectivePoster);

  const effectiveDescription = description || showDescription;

  const metaParts: string[] = [formatDuration(duration)];
  if (intermissions === 0) metaParts.push("No intermission");
  else if (intermissions && intermissions > 0)
    metaParts.push(`${intermissions} intermission${intermissions > 1 ? "s" : ""}`);
  if (languages && languages.length > 0) metaParts.push(languages.join(", "));

  const dateRange = (() => {
    if (!startDate) return null;
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (!endDate || startDate === endDate) return fmt(startDate);
    return `${fmt(startDate)} – ${fmt(endDate)}`;
  })();

  // Compact info for hero overlay — full details go in the dinn-panel below
  const heroSub = (
    <>
      {venues.length > 0 && (
        <p className="mt-1 text-xs text-curtn-muted/70 flex items-center gap-1">
          <Icon name="map-pin" size={12} />
          {venues[0].name}, {venues[0].city}
        </p>
      )}
      {dateRange && (
        <p className="mt-0.5 text-xs text-curtn-muted/70 flex items-center gap-1">
          <Icon name="calendar" size={12} />
          {dateRange}
        </p>
      )}
      <p className="mt-0.5 text-xs text-curtn-muted/70">{metaParts.join(" · ")}</p>
    </>
  );

  return (
    <div>
      {hasHeroMedia ? (
        <div className="relative -mx-6 -mt-8 mb-6">
          {/* Backdrop — only show cover image when a separate poster exists */}
          <div className="relative h-[280px] sm:h-[400px] overflow-hidden">
            {effectiveImage && effectivePoster ? (
              <img src={effectiveImage} alt="" className="h-full w-full object-cover" onError={() => setBackdropFailed(true)} />
            ) : (
              <div className="h-full w-full bg-curtn-surface" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-curtn-deep via-curtn-deep/60 to-curtn-deep/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-curtn-deep/80 to-transparent" />
          </div>

          {/* Poster overlay — falls back to imageUrl */}
          <div className="relative -mt-28 sm:-mt-36 px-6 flex gap-5 items-end">
            <div className="w-[110px] sm:w-[140px] shrink-0">
              <div className="relative aspect-[2/3] rounded-sm border-2 border-curtn-dark/50 bg-curtn-surface shadow-2xl overflow-hidden">
                <img src={(effectivePoster || effectiveImage)!} alt={showTitle} className="h-full w-full object-cover" onError={() => setPosterFailed(true)} />
              </div>
            </div>
            <div className="flex-1 min-w-0 pb-1">
              {performanceTypes.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
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
              <h1 className="text-2xl sm:text-3xl font-bold text-curtn-cream leading-tight normal-case">{showTitle}</h1>
              {heroSub}
            </div>
          </div>
        </div>
      ) : (
        <>
          {performanceTypes.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
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

          <h1 className="text-2xl font-bold text-curtn-cream leading-tight normal-case">{showTitle}</h1>
          {heroSub}
        </>
      )}

      {effectiveDescription && (
        <div className="mt-4">
          <p
            className={`text-sm text-curtn-cream/80 leading-relaxed ${
              !expanded ? "line-clamp-4" : ""
            }`}
          >
            {effectiveDescription}
          </p>
          {effectiveDescription.length > 200 && (
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

      {/* Scenario A: single-performance date/time/ticket — ticket card style */}
      {performanceDate && (() => {
        const dateObj = new Date(performanceDate);
        const day = dateObj.getDate().toString().padStart(2, "0");
        const month = dateObj.toLocaleString("en-US", { month: "short" });
        return (
          <div className="mt-6 card-ticket">
            <div className={`ticket-stub ${soldOut ? "!bg-curtn-muted" : ""}`}>
              <div className="ticket-date">{day}</div>
              <div className="ticket-month">{month}</div>
            </div>
            <div className="ticket-body flex items-center justify-between">
              <div>
                <div className="ticket-title text-curtn-cream">
                  {formatShowDate(performanceDate)}
                </div>
                <div className="ticket-time">
                  {performanceTime && formatShowTime(performanceTime)}
                  {soldOut && (
                    <span className="badge badge-muted ml-2">Sold Out</span>
                  )}
                </div>
              </div>
              {!soldOut && ticketUrl && (
                <a
                  href={ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 border border-curtn-coral/30 px-3 py-1.5 text-xs text-curtn-coral transition-colors hover:bg-curtn-coral/10"
                >
                  <Icon name="ticket" size={12} />
                  Tickets
                </a>
              )}
            </div>
          </div>
        );
      })()}

      {/* Obra Dinn ledger — show metadata */}
      <div className="mt-6 dinn-panel">
        <div className="dinn-header">
          <span className="dinn-title">Record of Performance</span>
          {(averageRating !== null || reviewCount > 0) && (
            <span className="dinn-ref flex items-center gap-1">
              <Icon name="star" weight="fill" size={12} className="text-curtn-coral" />
              {averageRating !== null ? averageRating.toFixed(1) : "—"}
              <span className="text-curtn-muted/50">({reviewCount})</span>
            </span>
          )}
        </div>
        <div className="dinn-grid">
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
          <span className="dinn-label">Duration</span>
          <span className="dinn-value">{metaParts.join(" · ")}</span>
          {dateRange && !performanceDate && (
            <>
              <span className="dinn-label">Dates</span>
              <span className="dinn-value">{dateRange}</span>
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
        </div>
      </div>
    </div>
  );
}
