"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "urql";
import { VENUE_BY_SLUG_QUERY } from "@/lib/graphql/venues";
import { VenueHero } from "@/components/venues/VenueHero";
import { VenuePerformances } from "@/components/venues/VenuePerformances";
import { AddToListButton } from "@/components/lists/AddToListButton";
import { EntityFollowButton } from "@/components/follows/EntityFollowButton";
import { Button } from "@/components/Button";
import { InlineEditor } from "@/components/admin/InlineEditor";
import { EntityDataSourcesPanel } from "@/components/admin/EntityDataSourcesPanel";
import { ClaimCTA } from "@/components/claim/ClaimCTA";
import { EditHistory } from "@/components/auditLog/EditHistory";
import { PendingProposalsStrip } from "@/components/proposals/PendingProposalsStrip";
import { useAuth } from "@/lib/auth/useAuth";

function decodeId(globalId: string): string {
  return atob(globalId).split(":")[1];
}

export default function VenueDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const [editing, setEditing] = useState(false);

  const [{ data, fetching }] = useQuery({
    query: VENUE_BY_SLUG_QUERY,
    variables: { slug },
  });

  const venue = data?.venueBySlug;

  if (fetching) {
    return (
      <div className="px-2 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto animate-pulse space-y-4">
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
      <div className="px-2 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto">
        <p className="text-curtn-muted text-sm">Venue not found.</p>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto space-y-8">
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

      <ClaimCTA
        kind="venue"
        slug={venue.slug}
        name={venue.name}
        claimState={venue.claimState}
      />

      <PendingProposalsStrip
        targetKind="Venue"
        targetId={decodeId(venue.id)}
        isClaimant={!!user && !!venue.claimedBy?.id && decodeId(venue.claimedBy.id) === user.id}
      />

      <div className="flex items-center gap-3">
        <EntityFollowButton
          targetId={venue.id}
          targetType="venue"
          isFollowedByViewer={venue.isFollowedByViewer}
          size="sm"
        />
        <AddToListButton itemId={venue.id} listType="venues" />
      </div>

      {isAdmin && !editing && (
        <Button variant="tertiary" size="sm" icon="pencil" onClick={() => setEditing(true)}>
          Edit
        </Button>
      )}
      {isAdmin && (
        <EntityDataSourcesPanel entityType="venue" entityId={venue.id} />
      )}

      {editing && (
        <InlineEditor
          entityType="venue"
          entityId={decodeId(venue.id)}
          initialValues={{
            name: venue.name,
            venueType: venue.venueType || "theater",
            defaultPerformanceType: venue.defaultPerformanceType || "",
            address: venue.address,
            city: venue.city,
            state: venue.state,
            zipCode: venue.zipCode || "",
            capacity: venue.capacity ?? "",
            website: venue.website || "",
            phone: venue.phone || "",
            email: venue.email || "",
            permanentlyClosed: String(!!venue.permanentlyClosed),
            closedDate: venue.closedDate ? venue.closedDate.split("T")[0] : "",
            description: venue.description || "",
            imageUrl: venue.imageUrl || "",
          }}
          initialCoords={
            venue.coordinates?.lat != null && venue.coordinates?.lng != null
              ? { lat: venue.coordinates.lat, lng: venue.coordinates.lng }
              : null
          }
          onSaved={() => { setEditing(false); window.location.reload(); }}
          onCancel={() => setEditing(false)}
        />
      )}

      <VenuePerformances venueName={venue.name} />

      <EditHistory
        targetKind="Venue"
        targetId={decodeId(venue.id)}
        canEdit={isAdmin}
      />
    </div>
  );
}
