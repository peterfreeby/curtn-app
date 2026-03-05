"use client";

import { RunCard } from "@/components/runs/RunCard";

interface Run {
  id: string;
  show: {
    id: string;
    title: string;
    performanceTypes: string[];
  };
  venues: { id: string; name: string; slug: string; city: string }[];
  startDate: string | null;
  endDate: string | null;
  averageRating: number | null;
  reviewCount: number;
}

interface CompanyRunsProps {
  runs: Run[];
  companyName: string;
  companySlug: string;
}

export function CompanyRuns({ runs, companyName, companySlug }: CompanyRunsProps) {
  if (runs.length === 0) {
    return <p className="text-sm text-curtn-muted">No runs yet.</p>;
  }

  return (
    <div>
      <h2 className="mb-3 text-xs uppercase tracking-widest text-curtn-muted">
        Productions ({runs.length})
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {runs.map((run) => (
          <RunCard
            key={run.id}
            id={run.id}
            showTitle={run.show.title}
            performanceTypes={run.show.performanceTypes}
            companyName={companyName}
            companySlug={companySlug}
            venueName={run.venues?.[0]?.name}
            venueCity={run.venues?.[0]?.city}
            startDate={run.startDate}
            endDate={run.endDate}
            averageRating={run.averageRating}
            reviewCount={run.reviewCount}
          />
        ))}
      </div>
    </div>
  );
}
