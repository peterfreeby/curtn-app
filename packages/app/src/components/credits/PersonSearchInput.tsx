"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "urql";
import { SEARCH_PEOPLE_QUERY } from "@/lib/graphql/people";

interface PersonSearchInputProps {
  onSelect: (person: { id: string; name: string; slug: string } | null) => void;
  onNewName: (name: string) => void;
}

export function PersonSearchInput({ onSelect, onNewName }: PersonSearchInputProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [{ data }] = useQuery({
    query: SEARCH_PEOPLE_QUERY,
    variables: { search: query, first: 8 },
    pause: query.length < 2,
  });

  const results = data?.personList?.edges ?? [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onSelect(null);
          if (e.target.value.length >= 2) {
            onNewName(e.target.value);
          }
        }}
        placeholder="Search or enter new name..."
        className="w-full border-b border-curtn-dark bg-transparent px-0 py-2 text-sm text-curtn-cream placeholder:text-curtn-muted/50 focus:border-curtn-coral focus:outline-none"
      />

      {open && query.length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-curtn-dark bg-curtn-surface shadow-lg">
          {results.map((edge: any) => (
            <button
              key={edge.node.id}
              type="button"
              onClick={() => {
                onSelect(edge.node);
                setQuery(edge.node.name);
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-curtn-cream hover:bg-curtn-dark/50 transition-colors"
            >
              {edge.node.name}
            </button>
          ))}
          {results.length === 0 && (
            <div className="px-3 py-2 text-xs text-curtn-muted">
              No match — will create "{query}" as new person
            </div>
          )}
        </div>
      )}
    </div>
  );
}
