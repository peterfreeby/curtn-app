"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/Icons";
import { formatDuration } from "@/lib/format";

interface ShowHeroProps {
  title: string;
  description: string;
  performanceTypes: string[];
  duration: number;
  languages: string[] | null;
  averageRating: number | null;
  reviewCount: number;
}

export function ShowHero({
  title,
  description,
  performanceTypes,
  duration,
  languages,
  averageRating,
  reviewCount,
}: ShowHeroProps) {
  const [expanded, setExpanded] = useState(false);

  const metaParts: string[] = [formatDuration(duration)];
  if (languages && languages.length > 0) metaParts.push(languages.join(", "));

  return (
    <div>
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

      <p className="mt-2 text-xs text-curtn-muted/70">{metaParts.join(" · ")}</p>

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
