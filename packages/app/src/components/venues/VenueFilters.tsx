"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/icons/Icons";

const CITIES = ["NYC", "Minneapolis", "LA"] as const;

const VENUE_TYPES = [
  "theater",
  "concert-hall",
  "dance-studio",
  "comedy-club",
  "multi-purpose",
  "outdoor",
] as const;

const VENUE_TYPE_LABELS: Record<string, string> = {
  theater: "Theater",
  "concert-hall": "Concert Hall",
  "dance-studio": "Dance Studio",
  "comedy-club": "Comedy Club",
  "multi-purpose": "Multi-Purpose",
  outdoor: "Outdoor",
};

interface VenueFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedCity: string;
  onCityChange: (city: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
  autoFocus?: boolean;
}

export function VenueFilters({
  search,
  onSearchChange,
  selectedCity,
  onCityChange,
  selectedType,
  onTypeChange,
  autoFocus,
}: VenueFiltersProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  function handleSearchInput(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 200);
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <Icon name="magnifying-glass" size={16} className="text-curtn-muted" />
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search venues..."
          defaultValue={search}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="w-full rounded-lg border border-curtn-dark bg-curtn-surface py-2.5 pl-9 pr-4 text-sm text-curtn-cream placeholder:text-curtn-muted/50 focus:border-curtn-muted/50 focus:outline-none transition-colors"
        />
      </div>

      {/* City chips (single-select, "All" to clear) */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => onCityChange("")}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            selectedCity === ""
              ? "border-curtn-coral bg-curtn-coral/10 text-curtn-coral"
              : "border-curtn-dark text-curtn-muted hover:border-curtn-muted/50"
          }`}
        >
          All Cities
        </button>
        {CITIES.map((city) => (
          <button
            key={city}
            type="button"
            onClick={() => onCityChange(selectedCity === city ? "" : city)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              selectedCity === city
                ? "border-curtn-coral bg-curtn-coral/10 text-curtn-coral"
                : "border-curtn-dark text-curtn-muted hover:border-curtn-muted/50"
            }`}
          >
            {city}
          </button>
        ))}
      </div>

      {/* Venue type chips (single-select) */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {VENUE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onTypeChange(selectedType === type ? "" : type)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              selectedType === type
                ? "border-curtn-coral bg-curtn-coral/10 text-curtn-coral"
                : "border-curtn-dark text-curtn-muted hover:border-curtn-muted/50"
            }`}
          >
            {VENUE_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
