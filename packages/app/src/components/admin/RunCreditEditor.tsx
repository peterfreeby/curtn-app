"use client";

import { useState } from "react";
import { useMutation } from "urql";
import { Button } from "@/components/Button";
import { CREDIT_REMOVE_MUTATION } from "@/lib/graphql/credits";
import { AddCreditForm } from "@/components/credits/AddCreditForm";
import { AddShowCreditForm } from "@/components/credits/AddShowCreditForm";

interface Credit {
  id: string;
  role: string;
  person: { id: string; name: string; slug: string };
}

interface RunCreditEditorProps {
  runId: string; // Global ID
  showId?: string; // Global ID — for show-level credits
  cast: Credit[];
  crew: Credit[];
  showCredits?: { id: string; role: string; person: { name: string } }[];
  onChanged: () => void;
}

export function RunCreditEditor({
  runId,
  showId,
  cast,
  crew,
  showCredits,
  onChanged,
}: RunCreditEditorProps) {
  const [, executeRemove] = useMutation(CREDIT_REMOVE_MUTATION);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove(creditId: string) {
    setError(null);
    setRemoving(creditId);
    const result = await executeRemove({ input: { creditId } });
    setRemoving(null);
    if (result.data?.creditRemove?.error) {
      setError(result.data.creditRemove.error);
    } else {
      onChanged();
    }
  }

  function CreditRow({ credit }: { credit: Credit }) {
    return (
      <div className="flex items-center justify-between py-1.5 border-b border-curtn-dark/30">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-curtn-cream truncate">{credit.person.name}</span>
          <span className="text-xs text-curtn-muted">{credit.role}</span>
        </div>
        <button
          type="button"
          onClick={() => handleRemove(credit.id)}
          disabled={removing === credit.id}
          className="text-xs text-curtn-muted hover:text-curtn-red transition-colors cursor-pointer disabled:opacity-40 shrink-0"
        >
          {removing === credit.id ? "..." : "Remove"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Show-level credits */}
      {showCredits && showCredits.length > 0 && (
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[1px] text-curtn-muted mb-1">
            Creative ({showCredits.length})
          </h3>
          {showCredits.map((c) => (
            <div key={c.id} className="flex items-center gap-2 py-1.5 border-b border-curtn-dark/30">
              <span className="text-sm text-curtn-cream">{c.person.name}</span>
              <span className="text-xs text-curtn-muted">{c.role}</span>
            </div>
          ))}
        </div>
      )}

      {cast.length > 0 && (
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[1px] text-curtn-muted mb-1">
            Cast ({cast.length})
          </h3>
          {cast.map((c) => (
            <CreditRow key={c.id} credit={c} />
          ))}
        </div>
      )}

      {crew.length > 0 && (
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[1px] text-curtn-muted mb-1">
            Crew ({crew.length})
          </h3>
          {crew.map((c) => (
            <CreditRow key={c.id} credit={c} />
          ))}
        </div>
      )}

      {error && <p className="text-xs text-curtn-red">{error}</p>}

      {/* Add forms */}
      <div className="border-t border-curtn-dark/40 pt-3 space-y-4">
        {showId && (
          <AddShowCreditForm showId={showId} onAdded={onChanged} />
        )}
        <AddCreditForm runId={runId} onAdded={onChanged} />
      </div>
    </div>
  );
}
