"use client";

import { useState } from "react";
import { useQuery, useMutation } from "urql";
import { SEARCH_PEOPLE_QUERY } from "@/lib/graphql/people";
import { USER_CLAIM_PERSON_MUTATION } from "@/lib/graphql/users";

interface ClaimPromptProps {
  onClaimed: () => void;
}

export function ClaimPrompt({ onClaimed }: ClaimPromptProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [{ data, fetching: searching }] = useQuery({
    query: SEARCH_PEOPLE_QUERY,
    variables: { search, first: 8 },
    pause: search.length < 2,
  });

  const [{ fetching: claiming }, executeClaim] = useMutation(USER_CLAIM_PERSON_MUTATION);

  const results = data?.personList?.edges?.map((e: any) => e.node) ?? [];

  async function handleClaim(personId: string) {
    setError(null);
    const result = await executeClaim({ input: { personId } });
    if (result.data?.userClaimPerson?.error) {
      setError(result.data.userClaimPerson.error);
    } else if (result.error) {
      setError("Something went wrong");
    } else {
      onClaimed();
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full rounded-lg border border-dashed border-curtn-dark/60 bg-curtn-surface/50 py-4 px-4 text-center transition-colors hover:border-curtn-muted/40 cursor-pointer"
      >
        <p className="text-sm text-curtn-cream font-medium">
          Are you a performer or creator?
        </p>
        <p className="text-xs text-curtn-muted mt-0.5">
          Link your credits to your profile
        </p>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-curtn-dark bg-curtn-surface p-4 space-y-3">
      <div>
        <p className="text-sm text-curtn-cream font-medium">Find yourself</p>
        <p className="text-xs text-curtn-muted mt-0.5">
          Search for your name as it appears in show credits
        </p>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name..."
        className="w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream placeholder:text-curtn-muted/40 focus:border-curtn-coral focus:outline-none"
        autoFocus
      />

      {searching && (
        <div className="flex justify-center py-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
        </div>
      )}

      {!searching && search.length >= 2 && results.length === 0 && (
        <p className="text-xs text-curtn-muted py-2">
          No match found for &ldquo;{search}&rdquo;
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((person: any) => (
            <button
              key={person.id}
              type="button"
              onClick={() => handleClaim(person.id)}
              disabled={claiming}
              className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-curtn-dark/30 cursor-pointer disabled:opacity-50"
            >
              <span className="text-sm text-curtn-cream">{person.name}</span>
              <span className="text-xs text-curtn-muted">Claim</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-curtn-red">{error}</p>}

      <button
        type="button"
        onClick={() => { setExpanded(false); setSearch(""); }}
        className="text-xs text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer"
      >
        Cancel
      </button>
    </div>
  );
}
