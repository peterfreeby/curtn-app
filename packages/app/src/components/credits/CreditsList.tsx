"use client";

import { CreditRow } from "./CreditRow";

interface Credit {
  id: string;
  person: { id: string; name: string; slug: string };
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
          <h2 className="mb-2 text-xs uppercase tracking-widest text-curtn-muted">Cast</h2>
          <div className="divide-y divide-curtn-dark/30">
            {cast.map((c) => (
              <CreditRow
                key={c.id}
                personName={c.person.name}
                personSlug={c.person.slug}
                role={c.role}
              />
            ))}
          </div>
        </div>
      )}

      {crew.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs uppercase tracking-widest text-curtn-muted">Crew</h2>
          <div className="divide-y divide-curtn-dark/30">
            {crew.map((c) => (
              <CreditRow
                key={c.id}
                personName={c.person.name}
                personSlug={c.person.slug}
                role={c.role}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
