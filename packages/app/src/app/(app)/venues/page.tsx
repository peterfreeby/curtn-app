"use client";

import { Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { VenueFilters } from "@/components/venues/VenueFilters";
import { VenueGrid } from "@/components/venues/VenueGrid";
import { VENUE_LIST_QUERY } from "@/lib/graphql/venues";
import { InfiniteScrollSentinel } from "@/components/InfiniteScrollSentinel";
import { usePaginatedConnection } from "@/hooks/usePaginatedConnection";

function VenuesBrowser() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const search = searchParams.get("q") ?? "";
  const selectedCity = searchParams.get("city") ?? "";
  const selectedType = searchParams.get("type") ?? "";
  const autoFocus = searchParams.has("focus");

  const { edges, loading, loadingMore, hasNextPage, sentinelRef } =
    usePaginatedConnection({
      query: VENUE_LIST_QUERY,
      variables: {
        city: selectedCity || undefined,
        venueType: selectedType || undefined,
        search: search || undefined,
      },
      pageSize: 12,
      getConnection: (data: any) => data?.venueList,
    });

  const venues = edges.map((e: any) => e.node);

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    params.delete("focus");
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
        <VenueGrid venues={venues} loading={loading} />
      </div>

      <InfiniteScrollSentinel
        sentinelRef={sentinelRef}
        loadingMore={loadingMore}
        hasNextPage={hasNextPage}
      />
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
