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
      {/* Search input */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <Icon name="magnifying-glass" size={16} className="text-curtn-muted" />
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search performances..."
          defaultValue={search}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="w-full rounded-lg border border-curtn-dark bg-curtn-surface py-2.5 pl-9 pr-4 text-sm text-curtn-cream placeholder:text-curtn-muted/50 focus:border-curtn-muted/50 focus:outline-none transition-colors"
        />
      </div>

      {/* Type chips + upcoming toggle */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => onUpcomingChange(!upcoming)}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            upcoming
              ? "border-curtn-coral bg-curtn-coral/10 text-curtn-coral"
              : "border-curtn-dark text-curtn-muted hover:border-curtn-muted/50"
          }`}
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
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                active
                  ? "border-curtn-coral bg-curtn-coral/10 text-curtn-coral"
                  : "border-curtn-dark text-curtn-muted hover:border-curtn-muted/50"
              }`}
            >
              {type}
            </button>
          );
        })}
      </div>
    </div>
  );
}
