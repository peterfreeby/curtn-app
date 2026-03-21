"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "urql";
import {
  SEARCH_COMPANIES_QUERY,
  PRODUCTION_COMPANY_CREATE_MUTATION,
} from "@/lib/graphql/companies";

interface CompanyResult {
  id: string;
  name: string;
  slug: string;
}

interface CompanySearchInputProps {
  onSelect: (company: CompanyResult) => void;
}

export function CompanySearchInput({ onSelect }: CompanySearchInputProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [, createCompany] = useMutation(PRODUCTION_COMPANY_CREATE_MUTATION);

  useEffect(() => {
    timerRef.current = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const [{ data, fetching }] = useQuery({
    query: SEARCH_COMPANIES_QUERY,
    variables: { search: debouncedQuery, first: 8 },
    pause: debouncedQuery.length < 2,
  });

  const results: CompanyResult[] =
    data?.productionCompanyList?.edges?.map((e: any) => e.node) ?? [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (company: CompanyResult) => {
      setQuery(company.name);
      setIsOpen(false);
      setIsCreating(false);
      onSelect(company);
    },
    [onSelect]
  );

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    const result = await createCompany({
      input: { name: newName.trim() },
    });
    const company = result.data?.productionCompanyCreate?.productionCompany;
    if (company) {
      setQuery(company.name);
      setIsCreating(false);
      setIsOpen(false);
      onSelect(company);
    }
  }, [newName, createCompany, onSelect]);

  if (isCreating) {
    return (
      <div ref={containerRef}>
        <label className="text-xs uppercase tracking-widest text-curtn-muted mb-2 block">
          New Production Company
        </label>
        <div className="flex gap-3 items-end">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Company name"
            className="flex-1 bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
            autoFocus
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="text-xs font-medium text-curtn-coral hover:text-curtn-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreating(false);
              setNewName("");
            }}
            className="text-xs text-curtn-muted hover:text-curtn-cream transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor="company-search"
        className="text-xs uppercase tracking-widest text-curtn-muted mb-2 block"
      >
        Production Company
      </label>
      <input
        id="company-search"
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => query.length >= 2 && setIsOpen(true)}
        placeholder="Search for a company..."
        className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
        autoComplete="off"
      />
      {isOpen && debouncedQuery.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full border border-curtn-dark/50 bg-curtn-surface shadow-xl max-h-64 overflow-y-auto dog-ear dog-ear-sm">
          {fetching && (
            <div className="px-4 py-3 text-sm text-curtn-muted">
              Searching...
            </div>
          )}
          {!fetching &&
            results.map((company) => (
              <button
                key={company.id}
                type="button"
                onClick={() => handleSelect(company)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-curtn-dark/30 transition-colors cursor-pointer"
              >
                <span className="text-curtn-cream font-medium">
                  {company.name}
                </span>
              </button>
            ))}
          {!fetching && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-curtn-muted">
              No companies found.
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setIsCreating(true);
              setNewName(query);
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-3 text-xs text-curtn-coral hover:bg-curtn-dark/30 transition-colors border-t border-curtn-dark/30 cursor-pointer"
          >
            Can&apos;t find it? Create new company
          </button>
        </div>
      )}
    </div>
  );
}
