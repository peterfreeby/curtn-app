"use client";

import Link from "next/link";

interface Credit {
  id: string;
  role: string;
  creditType?: string;
  run: {
    id: string;
    show: { id: string; title: string };
    productionCompany: { name: string; slug: string } | null;
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

interface ProfileCreditsProps {
  castCredits: Credit[];
  crewCredits: Credit[];
  showCredits: ShowCredit[];
  isOwnProfile: boolean;
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate) return "";
  const start = new Date(startDate);
  const startYear = start.getFullYear();
  if (!endDate) return String(startYear);
  const end = new Date(endDate);
  const endYear = end.getFullYear();
  return startYear === endYear ? String(startYear) : `${startYear}–${endYear}`;
}

function CreditBreadcrumb({ credit, index }: { credit: Credit; index: number }) {
  const run = credit.run;
  const venue = run.venues?.[0];
  const dateRange = formatDateRange(run.startDate, run.endDate);

  return (
    <Link href={`/runs/${run.id}`} className="list-item">
      <span className="li-num">{String(index).padStart(2, "0")}</span>
      <span className="li-content">
        <span className="li-title">{run.show.title}</span>
        <span className="li-sub ml-2">
          {credit.role}
          {run.productionCompany?.name ? ` · ${run.productionCompany.name}` : ""}
          {venue ? ` @ ${venue.name}` : ""}
        </span>
      </span>
      {dateRange && <span className="li-right">{dateRange}</span>}
    </Link>
  );
}

function ShowCreditBreadcrumb({ credit, index }: { credit: ShowCredit; index: number }) {
  return (
    <div className="list-item">
      <span className="li-num">{String(index).padStart(2, "0")}</span>
      <span className="li-content">
        <span className="li-title">{credit.show.title}</span>
        <span className="li-sub ml-2">{credit.role}</span>
      </span>
    </div>
  );
}

export function ProfileCredits({
  castCredits,
  crewCredits,
  showCredits,
  isOwnProfile,
}: ProfileCreditsProps) {
  const totalCredits = castCredits.length + crewCredits.length + showCredits.length;

  if (totalCredits === 0) {
    return (
      <div className="empty-state">
        <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">
          No Credits Yet
        </p>
        <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">
          {isOwnProfile
            ? "Add your first credit from a run page."
            : "This person hasn\u2019t been credited in any productions yet."}
        </p>
      </div>
    );
  }

  // Sort run credits by date descending (most recent first)
  const sortByDate = (a: Credit, b: Credit) => {
    const dateA = a.run.startDate ? new Date(a.run.startDate).getTime() : 0;
    const dateB = b.run.startDate ? new Date(b.run.startDate).getTime() : 0;
    return dateB - dateA;
  };

  const sortedCast = [...castCredits].sort(sortByDate);
  const sortedCrew = [...crewCredits].sort(sortByDate);

  return (
    <div className="space-y-6">
      {showCredits.length > 0 && (
        <div>
          <h2 className="mb-1 text-xs uppercase tracking-widest text-curtn-muted">
            Creative ({showCredits.length})
          </h2>
          {showCredits.map((c, i) => (
            <ShowCreditBreadcrumb key={c.id} credit={c} index={i + 1} />
          ))}
        </div>
      )}

      {sortedCast.length > 0 && (
        <div>
          <h2 className="mb-1 text-xs uppercase tracking-widest text-curtn-muted">
            Cast ({sortedCast.length})
          </h2>
          {sortedCast.map((c, i) => (
            <CreditBreadcrumb key={c.id} credit={c} index={i + 1} />
          ))}
        </div>
      )}

      {sortedCrew.length > 0 && (
        <div>
          <h2 className="mb-1 text-xs uppercase tracking-widest text-curtn-muted">
            Crew ({sortedCrew.length})
          </h2>
          {sortedCrew.map((c, i) => (
            <CreditBreadcrumb key={c.id} credit={c} index={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
