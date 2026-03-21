"use client";

import Link from "next/link";
import { Icon } from "@/components/icons/Icons";

interface VenueCardProps {
  slug: string;
  name: string;
  venueType: string;
  address: string;
  city: string;
  state: string;
  capacity: number | null;
  imageUrl?: string | null;
  permanentlyClosed?: boolean;
}

const VENUE_TYPE_LABELS: Record<string, string> = {
  theater: "Theater",
  "concert-hall": "Concert Hall",
  "dance-studio": "Dance Studio",
  "comedy-club": "Comedy Club",
  "multi-purpose": "Multi-Purpose",
  outdoor: "Outdoor",
  other: "Venue",
};

export function VenueCard({
  slug,
  name,
  venueType,
  address,
  city,
  state,
  capacity,
  imageUrl,
  permanentlyClosed,
}: VenueCardProps) {
  return (
    <Link
      href={`/venues/${slug}`}
      className="group block dog-ear border border-curtn-dark/50 bg-curtn-surface overflow-hidden transition-colors duration-200 hover:border-curtn-muted/50"
    >
      {/* Image header */}
      <div className="relative aspect-[16/9] overflow-hidden bg-curtn-dark/20">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${permanentlyClosed ? "opacity-50 grayscale" : ""}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon name="buildings" weight="thin" size={32} className="text-curtn-dark" />
          </div>
        )}
        {permanentlyClosed && (
          <div className="absolute inset-0 flex items-center justify-center bg-curtn-deep/40">
            <Icon name="ghost" weight="duotone" size={40} className="text-curtn-muted/60" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-[var(--spacing-2)]">
        <div className="flex items-center gap-1.5">
          <span className="inline-block bg-curtn-dark/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted">
            {VENUE_TYPE_LABELS[venueType] ?? venueType}
          </span>
          {permanentlyClosed && (
            <span className="inline-block bg-curtn-dark/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted/70">
              Closed
            </span>
          )}
        </div>

        <h3 className="mt-[var(--spacing-0_5)] text-sm font-semibold text-curtn-cream line-clamp-2 leading-snug">
          {name}
        </h3>

        <p className="mt-[var(--spacing-0_5)] text-xs text-curtn-muted truncate">
          {city}, {state}
        </p>

        {capacity && (
          <div className="mt-[var(--spacing-0_5)] flex items-center gap-1 text-xs text-curtn-muted/70">
            <Icon name="user" size={12} className="text-curtn-muted/50" />
            <span>{capacity} seats</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export { VENUE_TYPE_LABELS };
