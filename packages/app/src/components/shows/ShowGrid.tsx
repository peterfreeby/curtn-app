"use client";

import { WiredPosterCard } from "@/components/WiredPosterCard";

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

export function ShowGrid({ shows, loading }: ShowGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-[var(--spacing-2)]">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] rounded-[var(--spacing-1)] bg-curtn-dark/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (shows.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-curtn-muted text-sm">No shows found.</p>
      </div>
    );
  }

  // Deduplicate by ID
  const seen = new Set<string>();
  const uniqueShows = shows.filter((show) => {
    if (seen.has(show.id)) return false;
    seen.add(show.id);
    return true;
  });

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-[var(--spacing-2)]">
      {uniqueShows.map((show) => {
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
            imageUrl={show.imageUrl}
            title={show.title}
            subtitle={firstRun?.productionCompany?.name ?? undefined}
            href={`/performances/${show.id}`}
            size="md"
            className="!w-full"
            runId={singleRunId}
            runs={runs.length > 1 ? runs : undefined}
            isOnWatchlist={show.isOnMyWatchlist}
          />
        );
      })}
    </div>
  );
}
