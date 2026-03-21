"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/icons/Icons";

const PERFORMANCE_TYPES = [
  "theater",
  "musical",
  "dance",
  "comedy",
  "improv",
  "spoken-word",
  "cabaret",
  "experimental",
  "immersive",
  "drag",
  "burlesque",
  "happening",
] as const;

interface PerformanceFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
  upcoming: boolean;
  onUpcomingChange: (value: boolean) => void;
  autoFocus?: boolean;
}

export function PerformanceFilters({
  search,
  onSearchChange,
  selectedTypes,
  onTypesChange,
  upcoming,
  onUpcomingChange,
  autoFocus,
}: PerformanceFiltersProps) {
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

  function toggleType(type: string) {
    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter((t) => t !== type));
    } else {
      onTypesChange([...selectedTypes, type]);
    }
  }

  return (
    <div className="space-y-4">
      {/* Search input — dog-ear search bar */}
      <div className="dog-ear dog-ear-sm flex items-center bg-curtn-surface border border-curtn-dark/50 px-4">
        <Icon name="magnifying-glass" size={14} className="text-curtn-muted shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search performances..."
          defaultValue={search}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="flex-1 bg-transparent border-none py-2.5 pl-2 pr-4 text-sm text-curtn-cream placeholder:text-curtn-muted/50 focus:outline-none"
        />
      </div>

      {/* Type chips + upcoming toggle — stamp edge */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => onUpcomingChange(!upcoming)}
          className={`shrink-0 chip-stamp cursor-pointer ${upcoming ? "active" : ""}`}
        >
          Upcoming
        </button>

        {PERFORMANCE_TYPES.map((type) => {
          const active = selectedTypes.includes(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={`shrink-0 chip-stamp capitalize cursor-pointer ${active ? "active" : ""}`}
            >
              {type}
            </button>
          );
        })}
      </div>
    </div>
  );
}
