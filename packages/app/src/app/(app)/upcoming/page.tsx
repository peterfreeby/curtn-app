"use client";

import { useState, useMemo } from "react";
import { useQuery } from "urql";
import Link from "next/link";
import dynamic from "next/dynamic";
import { BROWSE_PERFORMANCES_QUERY } from "@/lib/graphql/performances";
import { Button } from "@/components/Button";
import { Icon } from "@/components/icons/Icons";
import { formatShowDate, formatShowTime } from "@/lib/format";

// Dynamic import for Leaflet (SSR incompatible)
const PerformanceMap = dynamic(
  () => import("@/components/map/PerformanceMap").then((m) => m.PerformanceMap),
  { ssr: false, loading: () => <div className="h-[400px] bg-curtn-dark/30 animate-pulse rounded-sm" /> }
);

type DateFilter = "all" | "today" | "weekend" | "week" | "next-week";

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Tonight" },
  { key: "weekend", label: "This Weekend" },
  { key: "week", label: "This Week" },
  { key: "next-week", label: "Next Week" },
];

function getDateRange(filter: DateFilter): { start: Date; end: Date } | null {
  if (filter === "all") return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay();

  switch (filter) {
    case "today": {
      const end = new Date(today);
      end.setDate(end.getDate() + 1);
      return { start: today, end };
    }
    case "weekend": {
      const saturday = new Date(today);
      saturday.setDate(saturday.getDate() + (6 - dayOfWeek));
      const monday = new Date(saturday);
      monday.setDate(monday.getDate() + 2);
      return { start: dayOfWeek >= 5 ? today : saturday, end: monday };
    }
    case "week": {
      const endOfWeek = new Date(today);
      endOfWeek.setDate(endOfWeek.getDate() + (7 - dayOfWeek));
      return { start: today, end: endOfWeek };
    }
    case "next-week": {
      const nextMonday = new Date(today);
      nextMonday.setDate(nextMonday.getDate() + (8 - dayOfWeek));
      const nextSunday = new Date(nextMonday);
      nextSunday.setDate(nextSunday.getDate() + 7);
      return { start: nextMonday, end: nextSunday };
    }
  }
}

export default function UpcomingPage() {
  const [view, setView] = useState<"map" | "list">("map");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const [{ data, fetching }] = useQuery({
    query: BROWSE_PERFORMANCES_QUERY,
    variables: { first: 200 },
  });

  const allPerformances = useMemo(() => {
    return (data?.performanceList?.edges ?? []).map((e: any) => e.node);
  }, [data]);

  // Filter by date range
  const performances = useMemo(() => {
    const range = getDateRange(dateFilter);
    if (!range) return allPerformances;
    return allPerformances.filter((p: any) => {
      const d = new Date(p.date);
      return d >= range.start && d < range.end;
    });
  }, [allPerformances, dateFilter]);

  // Group by date for list view
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
    <div className="px-6 py-8 max-w-[var(--content-width)] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-curtn-cream">Upcoming</h1>
        <div className="flex rounded-lg border border-curtn-dark overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setView("map")}
            className={`px-3 py-1.5 transition-colors cursor-pointer flex items-center gap-1 ${
              view === "map" ? "bg-curtn-dark text-curtn-cream" : "text-curtn-muted hover:text-curtn-cream"
            }`}
          >
            <Icon name="map-pin" size={12} />
            Map
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={`px-3 py-1.5 transition-colors cursor-pointer flex items-center gap-1 ${
              view === "list" ? "bg-curtn-dark text-curtn-cream" : "text-curtn-muted hover:text-curtn-cream"
            }`}
          >
            <Icon name="calendar" size={12} />
            List
          </button>
        </div>
      </div>

      {/* Date filter chips */}
      <div className="flex gap-2 overflow-x-auto">
        {DATE_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setDateFilter(f.key)}
            className={`px-3 py-1.5 text-xs rounded-sm whitespace-nowrap transition-colors cursor-pointer ${
              dateFilter === f.key
                ? "bg-curtn-coral text-curtn-deep font-bold"
                : "bg-curtn-dark/50 text-curtn-muted hover:text-curtn-cream"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="text-xs text-curtn-muted">
        {performances.length} performance{performances.length !== 1 ? "s" : ""}
        {dateFilter !== "all" && " in this range"}
      </p>

      {fetching && (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
        </div>
      )}

      {/* Map view */}
      {!fetching && view === "map" && (
        <PerformanceMap performances={performances} className="h-[500px] sm:h-[600px]" />
      )}

      {/* List view */}
      {!fetching && view === "list" && (
        <div className="space-y-6">
          {groupedByDate.length === 0 && (
            <div className="empty-state">
              <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">
                No Performances Found
              </p>
              <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">
                {dateFilter === "all"
                  ? "No performances in the database yet."
                  : "Try a different date range."}
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
                <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-2">
                  {dayLabel}
                </h2>
                <div className="space-y-1">
                  {perfs.map((perf: any) => {
                    const show = perf.run?.show;
                    const company = perf.run?.productionCompany;
                    return (
                      <Link
                        key={perf.id}
                        href={`/showings/${encodeURIComponent(perf.id)}`}
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
      )}
    </div>
  );
}
