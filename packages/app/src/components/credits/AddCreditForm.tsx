"use client";

import { useState } from "react";
import { useMutation } from "urql";
import { CREDIT_ADD_MUTATION } from "@/lib/graphql/credits";
import { PersonSearchInput } from "./PersonSearchInput";
import { Button } from "@/components/Button";

interface AddCreditFormProps {
  runId: string;
  onAdded: () => void;
}

export function AddCreditForm({ runId, onAdded }: AddCreditFormProps) {
  const [selectedPerson, setSelectedPerson] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [newPersonName, setNewPersonName] = useState("");
  const [creditType, setCreditType] = useState<"cast" | "crew">("cast");
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [{ fetching }, addCredit] = useMutation(CREDIT_ADD_MUTATION);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedPerson && !newPersonName) {
      setError("Select or enter a person name");
      return;
    }
    if (!role.trim()) {
      setError("Role is required");
      return;
    }

    const input: any = {
      runId,
      creditType,
      role: role.trim(),
    };

    if (selectedPerson) {
      input.personId = selectedPerson.id;
    } else {
      input.personName = newPersonName;
    }

    const result = await addCredit({ input });
    if (result.data?.creditAdd?.error) {
      setError(result.data.creditAdd.error);
    } else {
      setSelectedPerson(null);
      setNewPersonName("");
      setRole("");
      onAdded();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-xs uppercase tracking-widest text-curtn-muted">Add Credit</h3>

      <PersonSearchInput
        onSelect={setSelectedPerson}
        onNewName={setNewPersonName}
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setCreditType("cast")}
          className={`px-3 py-1 text-xs transition-colors ${
            creditType === "cast"
              ? "bg-curtn-coral text-white"
              : "border border-curtn-dark text-curtn-muted hover:border-curtn-muted/50"
          }`}
        >
          Cast
        </button>
        <button
          type="button"
          onClick={() => setCreditType("crew")}
          className={`px-3 py-1 text-xs transition-colors ${
            creditType === "crew"
              ? "bg-curtn-coral text-white"
              : "border border-curtn-dark text-curtn-muted hover:border-curtn-muted/50"
          }`}
        >
          Crew
        </button>
      </div>

      <input
        type="text"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder={creditType === "cast" ? 'Role (e.g. "Hamlet")' : 'Role (e.g. "Director")'}
        className="w-full border-b border-curtn-dark bg-transparent px-0 py-2 text-sm text-curtn-cream placeholder:text-curtn-muted/50 focus:border-curtn-coral focus:outline-none"
      />

      {error && <p className="text-xs text-curtn-red">{error}</p>}

      <Button variant="secondary" disabled={fetching}>
        {fetching ? "Adding..." : "Add Credit"}
      </Button>
    </form>
  );
}
