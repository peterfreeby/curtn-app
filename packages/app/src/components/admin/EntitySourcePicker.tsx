"use client";

import { useState } from "react";
import { useQuery } from "urql";
import {
  SEARCH_ALL_VENUES_QUERY,
  SEARCH_ALL_PEOPLE_QUERY,
  SEARCH_ALL_COMPANIES_QUERY,
} from "@/lib/graphql/search";

type SourceEntityType = "venue" | "person" | "productionCompany";

interface SelectedEntity {
  id: string;
  name: string;
}

interface EntitySourcePickerProps {
  entityType: SourceEntityType;
  value: SelectedEntity | null;
  onChange: (entity: SelectedEntity | null) => void;
}

const CONFIG: Record<SourceEntityType, { query: any; rootField: string; placeholder: string }> = {
  venue: { query: SEARCH_ALL_VENUES_QUERY, rootField: "venueList", placeholder: "Search venues…" },
  person: { query: SEARCH_ALL_PEOPLE_QUERY, rootField: "personList", placeholder: "Search people…" },
  productionCompany: { query: SEARCH_ALL_COMPANIES_QUERY, rootField: "productionCompanyList", placeholder: "Search companies…" },
};

export function EntitySourcePicker({ entityType, value, onChange }: EntitySourcePickerProps) {
  const [search, setSearch] = useState("");
  const config = CONFIG[entityType];

  const [{ data }] = useQuery({
    query: config.query,
    variables: { search, first: 8 },
    pause: search.trim().length < 2,
  });

  const results: any[] = data?.[config.rootField]?.edges?.map((e: any) => e.node) ?? [];

  if (value) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 border border-curtn-dark bg-curtn-deep px-3 py-1.5 text-sm text-curtn-cream">
          {value.name}
        </span>
        <button
          type="button"
          onClick={() => { onChange(null); setSearch(""); }}
          className="text-[10px] uppercase tracking-wider text-curtn-muted hover:text-curtn-coral cursor-pointer"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={config.placeholder}
        className="w-full border border-curtn-dark bg-curtn-deep px-3 py-1.5 text-sm text-curtn-cream placeholder:text-curtn-muted/40 focus:border-curtn-muted/50 focus:outline-none"
      />
      {search.trim().length >= 2 && results.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto border border-curtn-dark bg-curtn-surface shadow-lg">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onChange({ id: r.id, name: r.name })}
              className="block w-full px-3 py-1.5 text-left text-sm text-curtn-cream hover:bg-curtn-dark/60 cursor-pointer"
            >
              {r.name}
              {r.city && <span className="ml-2 text-[10px] text-curtn-muted/50">{r.city}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
