"use client";

import { useParams } from "next/navigation";
import { useQuery } from "urql";
import { VENUE_BY_SLUG_QUERY } from "@/lib/graphql/venues";
import { VenueHero } from "@/components/venues/VenueHero";
import { VenuePerformances } from "@/components/venues/VenuePerformances";
import { AddToListButton } from "@/components/lists/AddToListButton";

export default function VenueDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [{ data, fetching }] = useQuery({
    query: VENUE_BY_SLUG_QUERY,
    variables: { slug },
  });

  const venue = data?.venueBySlug;

  if (fetching) {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto animate-pulse space-y-4">
        <div className="h-4 w-16 rounded-full bg-curtn-dark/60" />
        <div className="h-8 w-3/4 rounded bg-curtn-dark/60" />
        <div className="h-4 w-2/3 rounded bg-curtn-dark/60" />
        <div className="h-4 w-1/3 rounded bg-curtn-dark/60" />
        <div className="mt-6 h-24 rounded-lg bg-curtn-dark/60" />
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto">
        <p className="text-curtn-muted text-sm">Venue not found.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto space-y-8">
      <VenueHero
        name={venue.name}
        venueType={venue.venueType}
        address={venue.address}
        city={venue.city}
        state={venue.state}
        zipCode={venue.zipCode}
        capacity={venue.capacity}
        description={venue.description}
        website={venue.website}
        phone={venue.phone}
        email={venue.email}
        imageUrl={venue.imageUrl}
        permanentlyClosed={venue.permanentlyClosed}
        closedDate={venue.closedDate}
      />

      <AddToListButton itemId={venue.id} listType="venues" />

      <VenuePerformances venueName={venue.name} />
    </div>
  );
}
