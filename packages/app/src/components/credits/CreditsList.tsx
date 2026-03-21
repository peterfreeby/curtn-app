"use client";

import { CreditRow } from "./CreditRow";

interface Credit {
  id: string;
  person: { id: string; name: string; slug: string; headshotUrl?: string | null };
  role: string;
  order: number;
}

interface CreditsListProps {
  cast: Credit[];
  crew: Credit[];
}

export function CreditsList({ cast, crew }: CreditsListProps) {
  if (cast.length === 0 && crew.length === 0) return null;

  return (
    <div className="space-y-6">
      {cast.length > 0 && (
        <div>
          <h2 className="mb-1 text-xs uppercase tracking-widest text-curtn-muted">
            Cast ({cast.length})
          </h2>
          {cast.map((c, i) => (
            <CreditRow
              key={c.id}
              index={i + 1}
              personName={c.person.name}
              personSlug={c.person.slug}
              role={c.role}
              headshotUrl={c.person.headshotUrl}
            />
          ))}
        </div>
      )}

      {crew.length > 0 && (
        <div>
          <h2 className="mb-1 text-xs uppercase tracking-widest text-curtn-muted">
            Crew ({crew.length})
          </h2>
          {crew.map((c, i) => (
            <CreditRow
              key={c.id}
              index={i + 1}
              personName={c.person.name}
              personSlug={c.person.slug}
              role={c.role}
              headshotUrl={c.person.headshotUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
