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
  imageUrl?: string | null;
  permanentlyClosed?: boolean;
  closedDate?: string | null;
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
  imageUrl,
  permanentlyClosed,
  closedDate,
}: VenueHeroProps) {
  const [expanded, setExpanded] = useState(false);

  const fullAddress = [address, `${city}, ${state}`, zipCode]
    .filter(Boolean)
    .join(", ");

  const hasContact = website || phone || email;

  return (
    <div>
      {imageUrl ? (
        <div className="relative -mx-6 -mt-8 mb-6">
          <div className="relative h-[220px] sm:h-[280px] overflow-hidden torn-bottom">
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-curtn-deep via-curtn-deep/50 to-curtn-deep/10" />
          </div>

          <div className="relative -mt-16 px-6">
            <span className="inline-block bg-curtn-deep/60 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted">
              {VENUE_TYPE_LABELS[venueType] ?? venueType}
            </span>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-curtn-cream leading-tight normal-case">{name}</h1>
          </div>
        </div>
      ) : (
        <>
          <span className="inline-block bg-curtn-dark/60 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted">
            {VENUE_TYPE_LABELS[venueType] ?? venueType}
          </span>
          <h1 className="mt-3 text-2xl font-bold text-curtn-cream leading-tight normal-case">{name}</h1>
        </>
      )}

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

      {permanentlyClosed && (
        <div className="mt-4 flex items-center gap-2 border border-curtn-dark/50 bg-curtn-surface px-3 py-2">
          <Icon name="ghost" weight="duotone" size={18} className="shrink-0 text-curtn-muted" />
          <div className="text-sm text-curtn-muted">
            <span className="font-semibold text-curtn-cream">Permanently Closed</span>
            {closedDate && (
              <span className="ml-1.5 text-curtn-muted/70">
                — {new Date(closedDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
            )}
          </div>
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
