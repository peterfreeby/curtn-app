"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icons";
import { formatDuration } from "@/lib/format";

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
  creators?: Creator[];
  companyName?: string | null;
  companySlug?: string | null;
  venues: { name: string; slug: string; city: string }[];
  startDate: string | null;
  endDate: string | null;
  averageRating: number | null;
  reviewCount: number;
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
  creators,
  companyName,
  companySlug,
  venues,
  startDate,
  endDate,
  averageRating,
  reviewCount,
}: RunHeroProps) {
  const [expanded, setExpanded] = useState(false);

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

  return (
    <div>
      {imageUrl && (
        <div className="mb-4 overflow-hidden rounded-lg">
          <img
            src={imageUrl}
            alt={showTitle}
            className="w-full h-48 object-cover"
          />
        </div>
      )}

      {performanceTypes.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {performanceTypes.map((type) => (
            <span
              key={type}
              className="rounded-full bg-curtn-dark/60 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted"
            >
              {type}
            </span>
          ))}
        </div>
      )}

      <h1 className="text-2xl font-bold text-curtn-cream leading-tight">{showTitle}</h1>

      {creators && creators.length > 0 && (
        <p className="mt-1 text-sm text-curtn-muted">
          {creators.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ", "}
              <Link href={`/people/${c.person.slug}`} className="text-curtn-coral hover:underline">
                {c.person.name}
              </Link>
              <span className="text-curtn-muted/60"> ({c.role})</span>
            </span>
          ))}
        </p>
      )}

      {companyName && (
        <p className="mt-1 text-sm text-curtn-muted">
          by{" "}
          <Link
            href={`/companies/${companySlug}`}
            className="text-curtn-coral hover:underline"
          >
            {companyName}
          </Link>
        </p>
      )}

      <div className="mt-2 flex flex-col gap-0.5 text-xs text-curtn-muted/70">
        {venues.map((v) => (
          <Link
            key={v.slug}
            href={`/venues/${v.slug}`}
            className="flex items-center gap-1 hover:text-curtn-cream transition-colors"
          >
            <Icon name="map-pin" size={12} />
            {v.name}, {v.city}
          </Link>
        ))}
        {dateRange && (
          <span className="flex items-center gap-1">
            <Icon name="calendar" size={12} />
            {dateRange}
          </span>
        )}
      </div>

      <p className="mt-2 text-xs text-curtn-muted/70">{metaParts.join(" · ")}</p>

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

      {(averageRating !== null || reviewCount > 0) && (
        <div className="mt-4 flex items-center gap-1.5 text-sm">
          <Icon name="star" weight="fill" size={16} className="text-curtn-coral" />
          <span className="text-curtn-cream">
            {averageRating !== null ? `${averageRating.toFixed(1)} average` : "No ratings yet"}
          </span>
          <span className="text-curtn-muted/70">
            · {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
          </span>
        </div>
      )}
    </div>
  );
}
