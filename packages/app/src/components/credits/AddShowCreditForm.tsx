"use client";

import { useState } from "react";
import { useMutation } from "urql";
import { SHOW_CREDIT_CREATE_MUTATION } from "@/lib/graphql/credits";
import { Button } from "@/components/Button";

const ROLE_OPTIONS = [
  "Playwright",
  "Composer",
  "Lyricist",
  "Choreographer",
  "Librettist",
  "Adapter",
  "Creator",
];

interface AddShowCreditFormProps {
  showId: string;
  onAdded: () => void;
}

export function AddShowCreditForm({ showId, onAdded }: AddShowCreditFormProps) {
  const [personName, setPersonName] = useState("");
  const [role, setRole] = useState("Playwright");
  const [error, setError] = useState<string | null>(null);

  const [{ fetching }, createCredit] = useMutation(SHOW_CREDIT_CREATE_MUTATION);

  // Decode global ID to MongoDB ObjectId
  function decodeId(globalId: string): string {
    return atob(globalId).split(":")[1];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!personName.trim()) {
      setError("Person name is required");
      return;
    }

    const result = await createCredit({
      input: {
        showId: decodeId(showId),
        personName: personName.trim(),
        role,
      },
    });

    if (result.data?.showCreditCreate?.error) {
      setError(result.data.showCreditCreate.error);
    } else {
      setPersonName("");
      onAdded();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-xs uppercase tracking-widest text-curtn-muted">
        Add Creator
      </h3>

      <input
        type="text"
        value={personName}
        onChange={(e) => setPersonName(e.target.value)}
        placeholder="Person name (e.g. Lin-Manuel Miranda)"
        className="w-full border-b border-curtn-dark bg-transparent px-0 py-2 text-sm text-curtn-cream placeholder:text-curtn-muted/50 focus:border-curtn-coral focus:outline-none"
      />

      <div className="flex flex-wrap gap-1.5">
        {ROLE_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`chip-stamp cursor-pointer ${role === r ? "active" : ""}`}
          >
            {r}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-curtn-red">{error}</p>}

      <Button variant="secondary" disabled={fetching}>
        {fetching ? "Adding..." : "Add Creator"}
      </Button>
    </form>
  );
}
