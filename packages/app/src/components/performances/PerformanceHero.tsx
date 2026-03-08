"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/Icons";
import { formatDuration } from "@/lib/format";

interface PerformanceHeroProps {
  title: string;
  description: string;
  performanceTypes: string[];
  companyName: string;
  duration: number;
  intermissions: number | null;
  language: string[] | null;
  averageRating: number | null;
  reviewCount: number;
  imageUrl?: string | null;
}

export function PerformanceHero({
  title,
  description,
  performanceTypes,
  companyName,
  duration,
  intermissions,
  language,
  averageRating,
  reviewCount,
  imageUrl,
}: PerformanceHeroProps) {
  const [expanded, setExpanded] = useState(false);

  const metaParts: string[] = [formatDuration(duration)];
  if (intermissions === 0) metaParts.push("No intermission");
  else if (intermissions && intermissions > 0)
    metaParts.push(`${intermissions} intermission${intermissions > 1 ? "s" : ""}`);
  if (language && language.length > 0) metaParts.push(language.join(", "));

  return (
    <div>
      {imageUrl ? (
        <div className="relative -mx-6 -mt-8 mb-6">
          <div className="relative h-[240px] sm:h-[300px] overflow-hidden">
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-curtn-deep via-curtn-deep/60 to-curtn-deep/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-curtn-deep/80 to-transparent" />
          </div>

          <div className="relative -mt-28 sm:-mt-36 px-6 flex gap-5 items-end">
            <div className="w-[110px] sm:w-[140px] shrink-0">
              <div className="aspect-[2/3] overflow-hidden rounded-lg border-2 border-curtn-dark/50 bg-curtn-surface shadow-2xl">
                <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
              </div>
            </div>
            <div className="flex-1 min-w-0 pb-1">
              {performanceTypes.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {performanceTypes.map((type) => (
                    <span
                      key={type}
                      className="rounded-full bg-curtn-deep/60 backdrop-blur-sm px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold text-curtn-cream leading-tight">{title}</h1>
              <p className="mt-1 text-sm text-curtn-muted">by {companyName}</p>
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
                  className="rounded-full bg-curtn-dark/60 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted"
                >
                  {type}
                </span>
              ))}
            </div>
          )}

          <h1 className="text-2xl font-bold text-curtn-cream leading-tight">{title}</h1>
          <p className="mt-1 text-sm text-curtn-muted">by {companyName}</p>
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
