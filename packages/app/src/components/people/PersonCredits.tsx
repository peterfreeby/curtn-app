"use client";

import Link from "next/link";
import { Icon } from "@/components/icons/Icons";

interface Credit {
  id: string;
  role: string;
  run: {
    id: string;
    show: { id: string; title: string };
    productionCompany: { name: string; slug: string };
    venues: { name: string; city: string }[];
    startDate: string | null;
    endDate: string | null;
  };
}

interface PersonCreditsProps {
  castCredits: Credit[];
  crewCredits: Credit[];
}

function CreditItem({ credit, type }: { credit: Credit; type: "cast" | "crew" }) {
  const run = credit.run;
  const venue = run.venues?.[0];

  return (
    <Link
      href={`/runs/${run.id}`}
      className="block rounded-lg border border-curtn-dark/30 bg-curtn-surface p-3 transition-colors hover:border-curtn-muted/50"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-curtn-cream">{run.show.title}</h3>
        <span className="shrink-0 rounded-full bg-curtn-dark/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted">
          {credit.role}
        </span>
      </div>
      <p className="mt-1 text-xs text-curtn-muted truncate">
        {run.productionCompany?.name}
        {venue ? ` · ${venue.name}` : ""}
      </p>
      {run.startDate && (
        <p className="mt-0.5 text-xs text-curtn-muted/50 flex items-center gap-1">
          <Icon name="calendar" size={10} />
          {new Date(run.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          {run.endDate && run.endDate !== run.startDate && (
            <> – {new Date(run.endDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</>
          )}
        </p>
      )}
    </Link>
  );
}

export function PersonCredits({ castCredits, crewCredits }: PersonCreditsProps) {
  if (castCredits.length === 0 && crewCredits.length === 0) {
    return <p className="text-sm text-curtn-muted">No credits yet.</p>;
  }

  return (
    <div className="space-y-6">
      {castCredits.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-curtn-muted">
            Cast ({castCredits.length})
          </h2>
          <div className="space-y-2">
            {castCredits.map((c) => (
              <CreditItem key={c.id} credit={c} type="cast" />
            ))}
          </div>
        </div>
      )}

      {crewCredits.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-curtn-muted">
            Crew ({crewCredits.length})
          </h2>
          <div className="space-y-2">
            {crewCredits.map((c) => (
              <CreditItem key={c.id} credit={c} type="crew" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
