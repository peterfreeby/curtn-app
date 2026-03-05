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
}: VenueCardProps) {
  return (
    <Link
      href={`/venues/${slug}`}
      className="block rounded-lg border border-curtn-dark/50 bg-curtn-surface p-4 transition-colors duration-200 hover:border-curtn-muted/50"
    >
      <span className="inline-block rounded-full bg-curtn-dark/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted">
        {VENUE_TYPE_LABELS[venueType] ?? venueType}
      </span>

      <h3 className="mt-2 text-base font-semibold text-curtn-cream line-clamp-2 leading-snug">
        {name}
      </h3>

      <p className="mt-1 text-sm text-curtn-muted truncate">{address}</p>

      <p className="mt-0.5 text-sm text-curtn-muted/70">
        {city}, {state}
      </p>

      {capacity && (
        <div className="mt-2 flex items-center gap-1 text-xs text-curtn-muted/70">
          <Icon name="user" size={12} className="text-curtn-muted/50" />
          <span>{capacity} seats</span>
        </div>
      )}
    </Link>
  );
}

export { VENUE_TYPE_LABELS };
