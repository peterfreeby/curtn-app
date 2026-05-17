"use client";

import { PerformanceCard } from "./PerformanceCard";
import { PerformanceCardSkeleton } from "./PerformanceCardSkeleton";

interface PerformanceNode {
  id: string;
  title: string;
  performanceTypes: string[];
  company: { name: string };
  averageRating: number | null;
  reviewCount: number;
  upcomingPerformances: { date: string }[] | null;
}

interface PerformanceGridProps {
  performances: PerformanceNode[];
  loading: boolean;
}

export function PerformanceGrid({ performances, loading }: PerformanceGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <PerformanceCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (performances.length === 0) {
    return (
      <div className="empty-state">
        <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">No Performances Found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {performances.map((p) => (
        <PerformanceCard
          key={p.id}
          id={p.id}
          title={p.title}
          performanceTypes={p.performanceTypes}
          companyName={p.company.name}
          averageRating={p.averageRating}
          reviewCount={p.reviewCount}
          upcomingCount={p.upcomingPerformances?.length ?? 0}
        />
      ))}
    </div>
  );
}
