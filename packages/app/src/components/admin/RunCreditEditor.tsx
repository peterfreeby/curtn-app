"use client";

import { useState } from "react";
import { useMutation } from "urql";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { CREDIT_REMOVE_MUTATION, CREDIT_ADD_MUTATION } from "@/lib/graphql/credits";
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
  const [, executeAdd] = useMutation(CREDIT_ADD_MUTATION);
  const [removing, setRemoving] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [replaceName, setReplaceName] = useState("");
  const [replaceLoading, setReplaceLoading] = useState(false);
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

  async function handleReplace(oldCredit: Credit, creditType: "cast" | "crew") {
    if (!replaceName.trim()) return;
    setError(null);
    setReplaceLoading(true);

    // Remove old credit
    const removeResult = await executeRemove({ input: { creditId: oldCredit.id } });
    if (removeResult.data?.creditRemove?.error) {
      setError(removeResult.data.creditRemove.error);
      setReplaceLoading(false);
      return;
    }

    // Add new credit with same role
    const addResult = await executeAdd({
      input: {
        runId,
        personName: replaceName.trim(),
        creditType,
        role: oldCredit.role,
      },
    });

    setReplaceLoading(false);
    if (addResult.data?.creditAdd?.error) {
      setError(addResult.data.creditAdd.error);
    } else {
      setReplacing(null);
      setReplaceName("");
      onChanged();
    }
  }

  function CreditRow({ credit, creditType }: { credit: Credit; creditType: "cast" | "crew" }) {
    const isReplacing = replacing === credit.id;

    return (
      <div className="py-1.5 border-b border-curtn-dark/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm text-curtn-cream truncate">{credit.person.name}</span>
            <span className="text-xs text-curtn-muted">{credit.role}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isReplacing && (
              <>
                <button
                  type="button"
                  onClick={() => { setReplacing(credit.id); setReplaceName(""); }}
                  className="text-xs text-curtn-muted hover:text-curtn-coral transition-colors cursor-pointer"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(credit.id)}
                  disabled={removing === credit.id}
                  className="text-xs text-curtn-muted hover:text-curtn-red transition-colors cursor-pointer disabled:opacity-40"
                >
                  {removing === credit.id ? "..." : "Remove"}
                </button>
              </>
            )}
          </div>
        </div>
        {isReplacing && (
          <div className="mt-2 flex items-end gap-2">
            <div className="flex-1">
              <Input
                label={`Replace ${credit.person.name} with`}
                value={replaceName}
                onChange={(e) => setReplaceName(e.target.value)}
                placeholder="New person name"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleReplace(credit, creditType)}
              disabled={replaceLoading || !replaceName.trim()}
            >
              {replaceLoading ? "..." : "Replace"}
            </Button>
            <button
              type="button"
              onClick={() => setReplacing(null)}
              className="text-xs text-curtn-muted hover:text-curtn-cream cursor-pointer pb-1"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
            <CreditRow key={c.id} credit={c} creditType="cast" />
          ))}
        </div>
      )}

      {crew.length > 0 && (
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[1px] text-curtn-muted mb-1">
            Crew ({crew.length})
          </h3>
          {crew.map((c) => (
            <CreditRow key={c.id} credit={c} creditType="crew" />
          ))}
        </div>
      )}

      {error && <p className="text-xs text-curtn-red">{error}</p>}

      <div className="border-t border-curtn-dark/40 pt-3 space-y-4">
        {showId && (
          <AddShowCreditForm showId={showId} onAdded={onChanged} />
        )}
        <AddCreditForm runId={runId} onAdded={onChanged} />
      </div>
    </div>
  );
}
