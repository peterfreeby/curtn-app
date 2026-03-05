"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/Icons";
import { VENUE_TYPE_LABELS } from "./VenueCard";

interface VenueHeroProps {
  name: string;
  venueType: string;
  address: string;
  city: string;
  state: string;
  zipCode: string | null;
  capacity: number | null;
  description: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
}

export function VenueHero({
  name,
  venueType,
  address,
  city,
  state,
  zipCode,
  capacity,
  description,
  website,
  phone,
  email,
}: VenueHeroProps) {
  const [expanded, setExpanded] = useState(false);

  const fullAddress = [address, `${city}, ${state}`, zipCode]
    .filter(Boolean)
    .join(", ");

  const hasContact = website || phone || email;

  return (
    <div>
      <span className="inline-block rounded-full bg-curtn-dark/60 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted">
        {VENUE_TYPE_LABELS[venueType] ?? venueType}
      </span>

      <h1 className="mt-3 text-2xl font-bold text-curtn-cream leading-tight">
        {name}
      </h1>

      <div className="mt-2 flex items-start gap-1.5 text-sm text-curtn-muted">
        <Icon
          name="map-pin"
          size={14}
          className="mt-0.5 shrink-0 text-curtn-muted/70"
        />
        <span>{fullAddress}</span>
      </div>

      {capacity && (
        <p className="mt-1 text-xs text-curtn-muted/70">{capacity} seats</p>
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

      {hasContact && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-curtn-coral hover:underline"
            >
              <Icon name="globe" size={14} />
              Website
            </a>
          )}
          {phone && (
            <a
              href={`tel:${phone}`}
              className="inline-flex items-center gap-1 text-curtn-muted hover:text-curtn-cream"
            >
              <Icon name="phone" size={14} />
              {phone}
            </a>
          )}
          {email && (
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-1 text-curtn-muted hover:text-curtn-cream"
            >
              <Icon name="envelope" size={14} />
              {email}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
