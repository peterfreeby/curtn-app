"use client";

import { useEffect, useState } from "react";
import { WiredPosterCard } from "@/components/WiredPosterCard";

// Locked column counts per viewport — does not change with content size.
function useColumnCount(): number {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const compute = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) return 5;
      if (window.matchMedia("(min-width: 768px)").matches) return 5;
      if (window.matchMedia("(min-width: 640px)").matches) return 4;
      return 3;
    };
    const update = () => setCols(compute());
    update();
    const mqs = [
      window.matchMedia("(min-width: 1024px)"),
      window.matchMedia("(min-width: 768px)"),
      window.matchMedia("(min-width: 640px)"),
    ];
    mqs.forEach((mq) => mq.addEventListener("change", update));
    return () => mqs.forEach((mq) => mq.removeEventListener("change", update));
  }, []);
  return cols;
}

interface RunNode {
  id: string;
  productionCompany?: { name: string; slug: string } | null;
  venues?: { name: string; city: string }[];
  startDate?: string | null;
  endDate?: string | null;
}

interface ShowNode {
  id: string;
  title: string;
  performanceTypes: string[];
  imageUrl?: string | null;
  posterUrl?: string | null;
  averageRating: number | null;
  reviewCount: number;
  isOnMyWatchlist?: boolean;
  runs?: {
    edges: {
      node: RunNode;
    }[];
  };
}

interface ShowGridProps {
  shows: ShowNode[];
  loading: boolean;
}

function buildRunLabel(run: RunNode, showTitle: string): string {
  const parts: string[] = [];
  if (run.productionCompany?.name) parts.push(run.productionCompany.name);
  if (run.venues?.[0]?.name) parts.push(run.venues[0].name);
  if (run.startDate) {
    const d = new Date(run.startDate).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    parts.push(d);
  }
  return parts.length > 0 ? parts.join(" · ") : showTitle;
}

// Varied aspect ratios for skeleton placeholders so the masonry feels real
// before the images load.
const SKELETON_ASPECTS = [
  "aspect-[1/1.58]",
  "aspect-[2/3]",
  "aspect-[3/4]",
  "aspect-[1/1.4]",
  "aspect-[4/5]",
  "aspect-[1/1.7]",
  "aspect-[1/1.2]",
];

export function ShowGrid({ shows, loading }: ShowGridProps) {
  const colCount = useColumnCount();

  if (loading) {
    const skeletonColumns: number[][] = Array.from({ length: colCount }, () => []);
    Array.from({ length: 12 }).forEach((_, i) => {
      skeletonColumns[i % colCount].push(i);
    });
    return (
      <div className="flex gap-[var(--spacing-2)] items-start">
        {skeletonColumns.map((col, ci) => (
          <div key={ci} className="flex-1 min-w-0 flex flex-col gap-[var(--spacing-2)]">
            {col.map((i) => (
              <div
                key={i}
                className={`${SKELETON_ASPECTS[i % SKELETON_ASPECTS.length]} bg-curtn-dark/30 animate-pulse`}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (shows.length === 0) {
    return (
      <div className="empty-state">
        <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">No Shows Found</p>
      </div>
    );
  }

  // Deduplicate by ID
  const seen = new Set<string>();
  const uniqueShows = shows.filter((show) => {
    if (!show?.id) return false;
    if (seen.has(show.id)) return false;
    seen.add(show.id);
    return true;
  });

  // Round-robin shows into a fixed number of columns. Order is preserved
  // across re-renders so newly fetched pages don't reshuffle existing items.
  const columns: ShowNode[][] = Array.from({ length: colCount }, () => []);
  uniqueShows.forEach((show, i) => {
    columns[i % colCount].push(show);
  });

  return (
    <div className="flex gap-[var(--spacing-2)] items-start">
      {columns.map((col, ci) => (
        <div key={ci} className="flex-1 min-w-0 flex flex-col gap-[var(--spacing-2)]">
          {col.map((show) => {
            const runEdges = show.runs?.edges ?? [];
            const firstRun = runEdges[0]?.node;
            const singleRunId = runEdges.length === 1 ? firstRun?.id : undefined;
            const runs = runEdges.map((e) => ({
              id: e.node.id,
              label: buildRunLabel(e.node, show.title),
            }));

            return (
              <WiredPosterCard
                key={show.id}
                showId={show.id}
                imageUrl={show.posterUrl || show.imageUrl}
                title={show.title}
                subtitle={firstRun?.productionCompany?.name ?? undefined}
                href={`/performances/${show.id}`}
                size="md"
                className="!w-full"
                runId={singleRunId}
                runs={runs.length > 1 ? runs : undefined}
                isOnWatchlist={show.isOnMyWatchlist}
                naturalAspect
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

