"use client";

import { useState, useMemo, useCallback, Suspense, useRef } from "react";
import { useQuery } from "urql";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { BROWSE_PERFORMANCES_QUERY, MAP_PERFORMANCES_QUERY } from "@/lib/graphql/performances";
import { VENUE_MAP_QUERY } from "@/lib/graphql/venues";
import { Icon } from "@/components/icons/Icons";
import { formatShowTime } from "@/lib/format";
import {
  DATE_FILTERS,
  getActiveFilter,
  getDateRange,
  type DateFilter,
} from "@/lib/mapFilters";
import { useUserLocation } from "@/components/map/geolocate";

const PerformanceMap = dynamic(
  () => import("@/components/map/PerformanceMap").then((m) => m.PerformanceMap),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-curtn-deep" /> }
);

const VenueOnlyMap = dynamic(
  () => import("@/components/map/VenueOnlyMap").then((m) => m.VenueOnlyMap),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-curtn-deep" /> }
);

function UpcomingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"map" | "list">("map");
  const [listExpanded, setListExpanded] = useState(false);
  const [mapBounds, setMapBounds] = useState<{ swLat: number; swLng: number; neLat: number; neLng: number } | null>(null);
  const handleBoundsChange = useCallback((b: typeof mapBounds) => { setMapBounds(b); }, []);

  // Resolved once for the whole page so the VenueOnly → Performance map swap
  // doesn't re-prompt or fight the user's pan/zoom.
  const userLocation = useUserLocation();

  const dateFilter = (searchParams.get("filter") as DateFilter | null) ?? "all";
  const activeFilter = getActiveFilter(dateFilter);

  const setDateFilter = useCallback(
    (next: DateFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "all") params.delete("filter");
      else params.set("filter", next);
      const qs = params.toString();
      router.replace(qs ? `/upcoming?${qs}` : "/upcoming", { scroll: false });
    },
    [router, searchParams]
  );

  // Lightweight venue pins — paused until the map reports its initial bounds
  const [{ data: venueData }] = useQuery({
    query: VENUE_MAP_QUERY,
    variables: { first: 3000, ...mapBounds },
    pause: !mapBounds,
  });

  // Compute date range for the active filter and pass to the server
  const dateRange = useMemo(() => getDateRange(dateFilter), [dateFilter]);
  const dateVars = useMemo(() => ({
    startDate: dateRange?.start.toISOString() ?? undefined,
    endDate: dateRange?.end.toISOString() ?? undefined,
  }), [dateRange]);

  // Performance data for map (lightweight — no cast/descriptions)
  const [{ data: mapPerfData, fetching: mapFetching }] = useQuery({
    query: MAP_PERFORMANCES_QUERY,
    variables: { first: 3000, ...mapBounds, ...dateVars },
    pause: !mapBounds,
  });

  // Full performance data for list view (heavier, fetched only in list mode)
  const [{ data, fetching }] = useQuery({
    query: BROWSE_PERFORMANCES_QUERY,
    variables: { first: 200 },
    pause: view === "map",
  });

  const venues = useMemo(() => {
    return (venueData?.venueList?.edges ?? []).map((e: any) => e.node).filter((v: any) => v.coordinates?.lat);
  }, [venueData]);

  // Stable map pins — update ref when fresh data arrives, hold last value while
  // a pan/zoom refetch is in flight. Updating during render is intentional: the
  // ref must be current before hasMapData is computed below so PerformanceMap
  // never unmounts (which would reset the Leaflet viewport to NYC center).
  const stableMapPerfsRef = useRef<any[]>([]);
  if (mapPerfData) {
    stableMapPerfsRef.current = (mapPerfData.performanceList?.edges ?? []).map((e: any) => e.node);
  }
  const mapPerformances = stableMapPerfsRef.current;

  const hasMapData = mapPerformances.length > 0;

  // Date filtering is now server-side — mapPerformances is already filtered
  const filteredMapPerformances = mapPerformances;

  const allPerformances = useMemo(() => {
    return (data?.performanceList?.edges ?? []).map((e: any) => e.node);
  }, [data]);

  const performances = useMemo(() => {
    const range = getDateRange(dateFilter);
    if (!range) return allPerformances;
    return allPerformances.filter((p: any) => {
      const d = new Date(p.date);
      return d >= range.start && d < range.end;
    });
  }, [allPerformances, dateFilter]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, any[]>();
    const sorted = [...performances].sort(
      (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    for (const perf of sorted) {
      const key = new Date(perf.date).toISOString().split("T")[0];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(perf);
    }
    return Array.from(groups.entries());
  }, [performances]);

  return (
    <div className="fixed inset-0 md:top-16 md:bottom-0 overflow-hidden">
      {/* Full-canvas map — show venue pins immediately, enrich when performance data loads */}
      {view === "map" && (
        <div className="absolute inset-0">
          {hasMapData ? (
            <PerformanceMap performances={filteredMapPerformances} onBoundsChange={handleBoundsChange} initialCenter={userLocation} />
          ) : (
            <VenueOnlyMap venues={venues} onBoundsChange={handleBoundsChange} initialCenter={userLocation} />
          )}
          {/* Subtle refetch indicator — doesn't block the map */}
          {mapFetching && (
            <div className="absolute bottom-4 right-4 z-[1000] pointer-events-none">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
            </div>
          )}
        </div>
      )}

      {/* Top fade — map bleeds behind status bar + MobileTopBar; gradient keeps wordmark/avatar legible */}
      <div
        className="md:hidden absolute top-0 left-0 right-0 z-[500] pointer-events-none bg-gradient-to-b from-curtn-deep via-curtn-deep/85 to-transparent"
        style={{ height: "calc(env(safe-area-inset-top) + 4.5rem)" }}
      />
      {/* Bottom fade — map bleeds behind floating dock */}
      <div
        className="md:hidden absolute bottom-0 left-0 right-0 z-[500] pointer-events-none bg-gradient-to-t from-curtn-deep via-curtn-deep/85 to-transparent"
        style={{ height: "calc(env(safe-area-inset-bottom) + 5rem)" }}
      />

      {/* List view background */}
      {view === "list" && (
        <div
          className="absolute inset-0 overflow-y-auto bg-curtn-deep px-6 md:py-20"
          style={{
            paddingTop: "calc(env(safe-area-inset-top) + 5rem)",
            paddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)",
          }}
        >
          <div className="max-w-[var(--content-width)] mx-auto space-y-6">
            {groupedByDate.length === 0 && (
              <div className="empty-state">
                <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">
                  No Performances Found
                </p>
                <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">
                  {dateFilter === "all" ? "No performances in the database yet." : "Try a different date range."}
                </p>
              </div>
            )}

            {groupedByDate.map(([dateKey, perfs]) => {
              const dateObj = new Date(dateKey + "T12:00:00");
              const dayLabel = dateObj.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              });

              return (
                <div key={dateKey}>
                  <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-2">{dayLabel}</h2>
                  <div className="space-y-1">
                    {perfs.map((perf: any) => {
                      const show = perf.run?.show;
                      const company = perf.run?.productionCompany;
                      return (
                        <Link
                          key={perf.id}
                          href={perf.run?.id ? `/runs/${encodeURIComponent(perf.run.id)}` : `/showings/${encodeURIComponent(perf.id)}`}
                          className="flex items-center gap-3 py-2.5 border-b border-curtn-dark/30 hover:bg-curtn-surface/50 transition-colors -mx-2 px-2 rounded-sm"
                        >
                          {show?.posterUrl && (
                            <div className="w-8 shrink-0">
                              <div className="aspect-[2/3] overflow-hidden rounded-sm bg-curtn-dark/30">
                                <img src={show.posterUrl} alt="" className="h-full w-full object-cover" />
                              </div>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-curtn-cream font-medium truncate">
                              {show?.title || "Untitled"}
                            </p>
                            <p className="text-xs text-curtn-muted truncate">
                              {perf.time && formatShowTime(perf.time)}
                              {perf.venue && ` · ${perf.venue.name}`}
                              {company && ` · ${company.name}`}
                            </p>
                          </div>
                          {show?.performanceTypes?.[0] && (
                            <span className="text-[10px] text-curtn-muted/60 uppercase shrink-0">
                              {show.performanceTypes[0]}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating UI controls — sit BELOW MobileTopBar (wordmark + avatar) on mobile */}
      <div
        className="absolute left-4 right-4 z-[1000] pointer-events-none top-[calc(env(safe-area-inset-top)+3.5rem)] md:top-4"
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left: title + filters */}
          <div className="pointer-events-auto space-y-2">
            <h1 className="text-lg font-bold text-curtn-cream drop-shadow-md">
              {activeFilter.titleLabel}
              <span className="ml-2 text-xs font-normal text-curtn-muted">
                {view === "map" ? filteredMapPerformances.length : performances.length}
              </span>
            </h1>
            {/* Chips: foregrounded on desktop. On mobile, filter is opened via the floating-bar funnel button. */}
            <div className="hidden md:flex gap-1.5 flex-wrap">
              {DATE_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setDateFilter(f.key)}
                  className={`px-2.5 py-1 text-[11px] rounded-sm transition-colors cursor-pointer backdrop-blur-sm ${
                    dateFilter === f.key
                      ? "bg-curtn-coral text-curtn-deep font-bold"
                      : "bg-curtn-deep/80 text-curtn-muted hover:text-curtn-cream border border-curtn-dark/50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: view toggle (desktop only — mobile is map-only on this tab) */}
          <div className="hidden md:flex pointer-events-auto rounded-sm border border-curtn-dark/50 overflow-hidden text-xs backdrop-blur-sm bg-curtn-deep/80">
            <button
              type="button"
              onClick={() => setView("map")}
              className={`px-2.5 py-1.5 transition-colors cursor-pointer flex items-center gap-1 ${
                view === "map" ? "bg-curtn-dark text-curtn-cream" : "text-curtn-muted hover:text-curtn-cream"
              }`}
            >
              <Icon name="map-pin" size={12} />
              Map
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`px-2.5 py-1.5 transition-colors cursor-pointer flex items-center gap-1 ${
                view === "list" ? "bg-curtn-dark text-curtn-cream" : "text-curtn-muted hover:text-curtn-cream"
              }`}
            >
              <Icon name="calendar" size={12} />
              List
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {fetching && (
        <div className="absolute inset-0 flex items-center justify-center z-[1000] bg-curtn-deep/50">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
        </div>
      )}

    </div>
  );
}

export default function UpcomingPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-curtn-deep" />}>
      <UpcomingPageContent />
    </Suspense>
  );
}
