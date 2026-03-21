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
      {/* Search input — dog-ear search bar */}
      <div className="dog-ear dog-ear-sm flex items-center bg-curtn-surface border border-curtn-dark/50 px-4">
        <Icon name="magnifying-glass" size={14} className="text-curtn-muted shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search venues..."
          defaultValue={search}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="flex-1 bg-transparent border-none py-2.5 pl-2 pr-4 text-sm text-curtn-cream placeholder:text-curtn-muted/50 focus:outline-none"
        />
      </div>

      {/* City chips — stamp edge */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => onCityChange("")}
          className={`shrink-0 chip-stamp cursor-pointer ${selectedCity === "" ? "active" : ""}`}
        >
          All Cities
        </button>
        {CITIES.map((city) => (
          <button
            key={city}
            type="button"
            onClick={() => onCityChange(selectedCity === city ? "" : city)}
            className={`shrink-0 chip-stamp cursor-pointer ${selectedCity === city ? "active" : ""}`}
          >
            {city}
          </button>
        ))}
      </div>

      {/* Venue type chips — stamp edge */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {VENUE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onTypeChange(selectedType === type ? "" : type)}
            className={`shrink-0 chip-stamp cursor-pointer ${selectedType === type ? "active" : ""}`}
          >
            {VENUE_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
