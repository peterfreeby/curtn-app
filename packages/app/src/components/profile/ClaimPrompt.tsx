"use client";

import { useState } from "react";
import { useQuery, useMutation } from "urql";
import { SEARCH_PEOPLE_QUERY } from "@/lib/graphql/people";
import {
  SUBMIT_CLAIM_REQUEST_MUTATION,
  SUBMIT_CLAIM_REQUEST_NEW_PERSON_MUTATION,
  MY_CLAIM_REQUEST_QUERY,
} from "@/lib/graphql/claims";

interface ClaimPromptProps {
  onSubmitted?: () => void;
}

export function ClaimPrompt({ onSubmitted }: ClaimPromptProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [{ data: claimData, fetching: loadingClaim }] = useQuery({
    query: MY_CLAIM_REQUEST_QUERY,
  });

  const [{ data, fetching: searching }] = useQuery({
    query: SEARCH_PEOPLE_QUERY,
    variables: { search, first: 8 },
    pause: search.length < 2,
  });

  const [{ fetching: submitting }, submitClaim] = useMutation(SUBMIT_CLAIM_REQUEST_MUTATION);
  const [{ fetching: creatingNew }, submitNewPerson] = useMutation(SUBMIT_CLAIM_REQUEST_NEW_PERSON_MUTATION);

  const results = (data?.personList?.edges?.map((e: any) => e.node) ?? []).filter(Boolean);
  const pendingClaim = claimData?.myClaimRequest;

  async function handleClaim(personId: string) {
    setError(null);
    const result = await submitClaim({ input: { personId, message: message || undefined } });
    if (result.data?.submitClaimRequest?.error) {
      setError(result.data.submitClaimRequest.error);
    } else if (result.error) {
      setError("Something went wrong");
    } else {
      onSubmitted?.();
    }
  }

  async function handleCreateAndClaim() {
    if (search.trim().length < 2) return;
    setError(null);
    const result = await submitNewPerson({
      input: { personName: search.trim(), message: message || undefined },
    });
    if (result.data?.submitClaimRequestNewPerson?.error) {
      setError(result.data.submitClaimRequestNewPerson.error);
    } else if (result.error) {
      setError("Something went wrong");
    } else {
      onSubmitted?.();
    }
  }

  if (loadingClaim) return null;

  // Show pending state if user already has a claim request
  if (pendingClaim) {
    return (
      <div className="rounded-lg border border-curtn-dark bg-curtn-surface p-4">
        <p className="text-sm text-curtn-cream font-medium">Request pending</p>
        <p className="text-xs text-curtn-muted mt-1">
          Your request to claim <span className="text-curtn-cream">{pendingClaim.person.name}</span> is
          waiting for approval.
        </p>
      </div>
    );
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
        <div className="space-y-2 py-2">
          <p className="text-xs text-curtn-muted">
            No match found for &ldquo;{search}&rdquo;
          </p>
          <button
            type="button"
            onClick={handleCreateAndClaim}
            disabled={creatingNew}
            className="w-full rounded-lg border border-dashed border-curtn-coral/40 px-3 py-2 text-left transition-colors hover:bg-curtn-coral/5 cursor-pointer disabled:opacity-50"
          >
            <span className="text-sm text-curtn-coral">Create &ldquo;{search.trim()}&rdquo; and request claim</span>
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((person: any) => (
            <button
              key={person.id}
              type="button"
              onClick={() => handleClaim(person.id)}
              disabled={submitting}
              className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-curtn-dark/30 cursor-pointer disabled:opacity-50"
            >
              <span className="text-sm text-curtn-cream">{person.name}</span>
              <span className="text-xs text-curtn-muted">Claim</span>
            </button>
          ))}

          {search.length >= 2 && (
            <button
              type="button"
              onClick={handleCreateAndClaim}
              disabled={creatingNew}
              className="w-full rounded-lg border border-dashed border-curtn-coral/40 px-3 py-2 mt-2 text-left transition-colors hover:bg-curtn-coral/5 cursor-pointer disabled:opacity-50"
            >
              <span className="text-xs text-curtn-coral">Not listed? Create &ldquo;{search.trim()}&rdquo; and request claim</span>
            </button>
          )}
        </div>
      )}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Link a social profile, portfolio, or anything that helps us verify (optional)"
        rows={2}
        className="w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-xs text-curtn-cream placeholder:text-curtn-muted/40 focus:border-curtn-coral focus:outline-none resize-none"
      />

      {error && <p className="text-xs text-curtn-red">{error}</p>}

      <button
        type="button"
        onClick={() => { setExpanded(false); setSearch(""); setMessage(""); }}
        className="text-xs text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer"
      >
        Cancel
      </button>
    </div>
  );
}
