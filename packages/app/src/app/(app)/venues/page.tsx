"use client";

import { Suspense, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "urql";
import { VenueFilters } from "@/components/venues/VenueFilters";
import { VenueGrid } from "@/components/venues/VenueGrid";
import { VENUE_LIST_QUERY } from "@/lib/graphql/venues";

const PAGE_SIZE = 12;

function VenuesBrowser() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const search = searchParams.get("q") ?? "";
  const selectedCity = searchParams.get("city") ?? "";
  const selectedType = searchParams.get("type") ?? "";
  const autoFocus = searchParams.has("focus");

  const [after, setAfter] = useState<string | null>(null);
  const [prevEdges, setPrevEdges] = useState<any[]>([]);

  const [{ data, fetching }] = useQuery({
    query: VENUE_LIST_QUERY,
    variables: {
      first: PAGE_SIZE,
      after,
      city: selectedCity || undefined,
      venueType: selectedType || undefined,
      search: search || undefined,
    },
  });

  const connection = data?.venueList;
  const currentEdges = connection?.edges ?? [];
  const pageInfo = connection?.pageInfo;

  const displayEdges = after === null ? currentEdges : [...prevEdges, ...currentEdges];
  const venues = displayEdges.map((e: any) => e.node);

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    params.delete("focus");
    setAfter(null);
    setPrevEdges([]);
    router.replace(`/venues?${params.toString()}`, { scroll: false });
  }

  const handleSearchChange = useCallback(
    (value: string) => updateParams({ q: value || null }),
    [searchParams]
  );

  const handleCityChange = useCallback(
    (city: string) => updateParams({ city: city || null }),
    [searchParams]
  );

  const handleTypeChange = useCallback(
    (type: string) => updateParams({ type: type || null }),
    [searchParams]
  );

  function handleLoadMore() {
    if (pageInfo?.endCursor) {
      setPrevEdges(displayEdges);
      setAfter(pageInfo.endCursor);
    }
  }

  return (
    <>
      <VenueFilters
        search={search}
        onSearchChange={handleSearchChange}
        selectedCity={selectedCity}
        onCityChange={handleCityChange}
        selectedType={selectedType}
        onTypeChange={handleTypeChange}
        autoFocus={autoFocus}
      />

      <div className="mt-6">
        <VenueGrid venues={venues} loading={fetching && after === null} />
      </div>

      {!fetching && pageInfo?.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            className="rounded-lg border border-curtn-dark px-6 py-2.5 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream"
          >
            Load more
          </button>
        </div>
      )}

      {fetching && after !== null && (
        <div className="mt-6 flex justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
        </div>
      )}
    </>
  );
}

export default function VenuesPage() {
  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-6">
        Browse Venues
      </h2>
      <Suspense
        fallback={
          <div className="mt-6">
            <VenueGrid venues={[]} loading={true} />
          </div>
        }
      >
        <VenuesBrowser />
      </Suspense>
    </div>
  );
}
