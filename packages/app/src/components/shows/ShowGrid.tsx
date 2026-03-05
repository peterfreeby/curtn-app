"use client";

import { ShowCard } from "./ShowCard";
import { PerformanceCardSkeleton } from "@/components/performances/PerformanceCardSkeleton";

interface ShowNode {
  id: string;
  title: string;
  performanceTypes: string[];
  averageRating: number | null;
  reviewCount: number;
  runs?: {
    edges: {
      node: {
        productionCompany: { name: string; slug: string };
      };
    }[];
  };
}

interface ShowGridProps {
  shows: ShowNode[];
  loading: boolean;
}

export function ShowGrid({ shows, loading }: ShowGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <PerformanceCardSkeleton key={i} />
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

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {shows.map((show) => {
        const firstRun = show.runs?.edges?.[0]?.node;
        return (
          <ShowCard
            key={show.id}
            id={show.id}
            title={show.title}
            performanceTypes={show.performanceTypes}
            companyName={firstRun?.productionCompany?.name}
            companySlug={firstRun?.productionCompany?.slug}
            averageRating={show.averageRating}
            reviewCount={show.reviewCount}
          />
        );
      })}
    </div>
  );
}
