"use client";

import Link from "next/link";

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

interface ShowCredit {
  id: string;
  role: string;
  show: { id: string; title: string };
}

interface PersonCreditsProps {
  castCredits: Credit[];
  crewCredits: Credit[];
  showCredits: ShowCredit[];
}

function CreditItem({ credit, index }: { credit: Credit; index: number }) {
  const run = credit.run;
  const venue = run.venues?.[0];
  const year = run.startDate
    ? new Date(run.startDate).getFullYear()
    : null;

  return (
    <Link href={`/runs/${run.id}`} className="list-item">
      <span className="li-num">{String(index).padStart(2, "0")}</span>
      <span className="li-content">
        <span className="li-title">{run.show.title}</span>
        <span className="li-sub">
          {credit.role}
          {run.productionCompany?.name ? ` · ${run.productionCompany.name}` : ""}
          {venue ? ` · ${venue.name}` : ""}
        </span>
      </span>
      {year && (
        <span className="li-right">{year}</span>
      )}
    </Link>
  );
}

function ShowCreditItem({ credit, index }: { credit: ShowCredit; index: number }) {
  return (
    <div className="list-item">
      <span className="li-num">{String(index).padStart(2, "0")}</span>
      <span className="li-content">
        <span className="li-title">{credit.show.title}</span>
        <span className="li-sub">{credit.role}</span>
      </span>
    </div>
  );
}

export function PersonCredits({ castCredits, crewCredits, showCredits }: PersonCreditsProps) {
  if (castCredits.length === 0 && crewCredits.length === 0 && showCredits.length === 0) {
    return <p className="text-sm text-curtn-muted">No credits yet.</p>;
  }

  return (
    <div className="space-y-6">
      {showCredits.length > 0 && (
        <div>
          <h2 className="mb-1 text-xs uppercase tracking-widest text-curtn-muted">
            Creative ({showCredits.length})
          </h2>
          {showCredits.map((c, i) => (
            <ShowCreditItem key={c.id} credit={c} index={i + 1} />
          ))}
        </div>
      )}

      {castCredits.length > 0 && (
        <div>
          <h2 className="mb-1 text-xs uppercase tracking-widest text-curtn-muted">
            Cast ({castCredits.length})
          </h2>
          {castCredits.map((c, i) => (
            <CreditItem key={c.id} credit={c} index={i + 1} />
          ))}
        </div>
      )}

      {crewCredits.length > 0 && (
        <div>
          <h2 className="mb-1 text-xs uppercase tracking-widest text-curtn-muted">
            Crew ({crewCredits.length})
          </h2>
          {crewCredits.map((c, i) => (
            <CreditItem key={c.id} credit={c} index={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
