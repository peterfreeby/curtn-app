"use client";

import { VenueCard } from "./VenueCard";
import { VenueCardSkeleton } from "./VenueCardSkeleton";

interface VenueNode {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  capacity: number | null;
  venueType: string;
  imageUrl?: string | null;
  permanentlyClosed?: boolean;
}

interface VenueGridProps {
  venues: VenueNode[];
  loading: boolean;
}

export function VenueGrid({ venues, loading }: VenueGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-[var(--spacing-2)] md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <VenueCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-curtn-muted text-sm">No venues found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-[var(--spacing-2)] md:grid-cols-2 lg:grid-cols-3">
      {venues.map((v) => (
        <VenueCard
          key={v.id}
          slug={v.slug}
          name={v.name}
          venueType={v.venueType}
          address={v.address}
          city={v.city}
          state={v.state}
          capacity={v.capacity}
          imageUrl={v.imageUrl}
          permanentlyClosed={v.permanentlyClosed}
        />
      ))}
    </div>
  );
}
