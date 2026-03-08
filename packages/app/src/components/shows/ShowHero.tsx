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
  creators,
  averageRating,
  reviewCount,
}: ShowHeroProps) {
  const [expanded, setExpanded] = useState(false);

  const metaParts: string[] = [formatDuration(duration)];
  if (languages && languages.length > 0) metaParts.push(languages.join(", "));

  return (
    <div>
      {imageUrl && (
        <div className="mb-4 overflow-hidden rounded-lg">
          <img
            src={imageUrl}
            alt={title}
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

      <h1 className="text-2xl font-bold text-curtn-cream leading-tight">{title}</h1>

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
