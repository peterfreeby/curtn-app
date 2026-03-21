"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icons";
import { formatDuration } from "@/lib/format";

interface Creator {
  id: string;
  person: { id: string; name: string; slug: string };
  role: string;
  order: number;
}

interface ShowHeroProps {
  title: string;
  description: string;
  performanceTypes: string[];
  duration: number;
  languages: string[] | null;
  imageUrl?: string | null;
  posterUrl?: string | null;
  creators?: Creator[];
  averageRating: number | null;
  reviewCount: number;
}

export function ShowHero({
  title,
  description,
  performanceTypes,
  duration,
  languages,
  imageUrl,
  posterUrl,
  creators,
  averageRating,
  reviewCount,
}: ShowHeroProps) {
  const [expanded, setExpanded] = useState(false);

  const metaParts: string[] = [formatDuration(duration)];
  if (languages && languages.length > 0) metaParts.push(languages.join(", "));

  return (
    <div>
      {/* Backdrop + poster layout when any image exists */}
      {(imageUrl || posterUrl) ? (
        <div className="relative -mx-6 -mt-8 mb-6">
          {/* Backdrop — only show cover image when a separate poster exists */}
          <div className="relative h-[240px] sm:h-[300px] overflow-hidden torn-bottom">
            {imageUrl && posterUrl ? (
              <img
                src={imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-curtn-surface" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-curtn-deep via-curtn-deep/60 to-curtn-deep/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-curtn-deep/80 to-transparent" />
          </div>

          {/* Poster overlay — falls back to imageUrl */}
          <div className="relative -mt-28 sm:-mt-36 px-6 flex gap-5 items-end">
            <div className="w-[110px] sm:w-[140px] shrink-0">
              <div className="dog-ear relative aspect-[2/3] border-2 border-curtn-dark/50 bg-curtn-surface shadow-2xl">
                <img src={(posterUrl || imageUrl)!} alt={title} className="h-full w-full object-cover" />
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
              <h1 className="text-2xl sm:text-3xl font-bold text-curtn-cream leading-tight normal-case">{title}</h1>
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
              <p className="mt-1 text-xs text-curtn-muted/70">{metaParts.join(" · ")}</p>
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

          <h1 className="text-2xl font-bold text-curtn-cream leading-tight normal-case">{title}</h1>

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

          <p className="mt-2 text-xs text-curtn-muted/70">{metaParts.join(" · ")}</p>
        </>
      )}

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

      {/* Obra Dinn ledger — show metadata */}
      <div className="mt-6 dinn-panel">
        <div className="dinn-header">
          <span className="dinn-title">Show Record</span>
          {(averageRating !== null || reviewCount > 0) && (
            <span className="dinn-ref flex items-center gap-1">
              <Icon name="star" weight="fill" size={12} className="text-curtn-coral" />
              {averageRating !== null ? averageRating.toFixed(1) : "—"}
              <span className="text-curtn-muted/50">({reviewCount})</span>
            </span>
          )}
        </div>
        <div className="dinn-grid">
          {performanceTypes.length > 0 && (
            <>
              <span className="dinn-label">Type</span>
              <span className="dinn-value capitalize">{performanceTypes.join(", ")}</span>
            </>
          )}
          <span className="dinn-label">Duration</span>
          <span className="dinn-value">{metaParts.join(" · ")}</span>
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
