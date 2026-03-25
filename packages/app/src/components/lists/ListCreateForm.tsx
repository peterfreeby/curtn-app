"use client";

import { useState } from "react";
import { useMutation } from "urql";
import { useRouter } from "next/navigation";
import { LIST_CREATE_MUTATION } from "@/lib/graphql/lists";
import { useAuth } from "@/lib/auth/useAuth";

const LIST_TYPES = [
  { value: "shows", label: "Shows" },
  { value: "venues", label: "Venues" },
  { value: "runs", label: "Runs" },
  { value: "performances", label: "Performances" },
  { value: "people", label: "People" },
];

export function ListCreateForm() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [listType, setListType] = useState("shows");
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [{ fetching }, executeCreate] = useMutation(LIST_CREATE_MUTATION);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    const result = await executeCreate({
      input: {
        name: name.trim(),
        description: description.trim(),
        listType,
        isPublic,
      },
    });

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (result.data?.listCreate?.error) {
      setError(result.data.listCreate.error);
      return;
    }

    const slug = result.data?.listCreate?.list?.slug;
    if (slug && user) {
      router.push(`/u/${user.username}/lists/${slug}`);
    } else {
      router.push("/lists");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="list-name" className="block text-xs uppercase tracking-widest text-curtn-muted mb-1.5">
          Name
        </label>
        <input
          id="list-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-curtn-dark bg-curtn-surface px-3 py-2 text-sm text-curtn-cream placeholder:text-curtn-muted/40 focus:border-curtn-muted/50 focus:outline-none"
          placeholder="My favorite venues..."
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="list-description" className="block text-xs uppercase tracking-widest text-curtn-muted mb-1.5">
          Description
        </label>
        <textarea
          id="list-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full border border-curtn-dark bg-curtn-surface px-3 py-2 text-sm text-curtn-cream placeholder:text-curtn-muted/40 focus:border-curtn-muted/50 focus:outline-none resize-none"
          placeholder="Optional description..."
        />
      </div>

      <div>
        <label htmlFor="list-type" className="block text-xs uppercase tracking-widest text-curtn-muted mb-1.5">
          Type
        </label>
        <select
          id="list-type"
          value={listType}
          onChange={(e) => setListType(e.target.value)}
          className="w-full border border-curtn-dark bg-curtn-surface px-3 py-2 text-sm text-curtn-cream focus:border-curtn-muted/50 focus:outline-none cursor-pointer"
        >
          {LIST_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="list-public"
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="cursor-pointer"
        />
        <label htmlFor="list-public" className="text-xs text-curtn-muted cursor-pointer">
          Public — anyone with the link can view
        </label>
      </div>

      {error && (
        <p className="text-xs text-curtn-coral">{error}</p>
      )}

      <button
        type="submit"
        disabled={fetching || !name.trim()}
        className="w-full bg-curtn-coral py-2.5 text-sm font-semibold text-curtn-deep uppercase tracking-wider transition-colors hover:bg-curtn-red disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {fetching ? "Creating..." : "Create List"}
      </button>
    </form>
  );
}
