"use client";

import { useState } from "react";
import { useQuery, useMutation } from "urql";
import Link from "next/link";
import {
  MY_LISTS_QUERY,
  LIST_CREATE_MUTATION,
  LIST_SET_EDITORIAL_MUTATION,
  LIST_DELETE_MUTATION,
  EDITORIAL_LISTS_QUERY,
} from "@/lib/graphql/lists";
import { Icon } from "@/components/icons/Icons";

const LIST_TYPES = [
  { value: "shows", label: "Shows" },
  { value: "venues", label: "Venues" },
  { value: "runs", label: "Runs" },
  { value: "performances", label: "Performances" },
  { value: "people", label: "People" },
];

export default function AdminListsPage() {
  const [name, setName] = useState("");
  const [listType, setListType] = useState("shows");
  const [error, setError] = useState<string | null>(null);

  const [{ data: editorialData, fetching: editorialFetching }, reexecuteEditorial] = useQuery({
    query: EDITORIAL_LISTS_QUERY,
    variables: {},
  });

  const [{ data: allListsData, fetching: allFetching }, reexecuteAll] = useQuery({
    query: MY_LISTS_QUERY,
    variables: { first: 100 },
  });

  const [, executeCreate] = useMutation(LIST_CREATE_MUTATION);
  const [, executeSetEditorial] = useMutation(LIST_SET_EDITORIAL_MUTATION);
  const [, executeDelete] = useMutation(LIST_DELETE_MUTATION);

  const editorialLists = editorialData?.editorialLists?.edges?.map((e: any) => e.node) ?? [];
  const allLists = allListsData?.myLists?.edges?.map((e: any) => e.node) ?? [];

  async function handleQuickCreate() {
    if (!name.trim()) return;
    setError(null);

    const result = await executeCreate({
      input: { name: name.trim(), listType, isPublic: true },
    });

    if (result.data?.listCreate?.error) {
      setError(result.data.listCreate.error);
      return;
    }

    const newList = result.data?.listCreate?.list;
    if (newList) {
      await executeSetEditorial({
        input: { listId: newList.id, isEditorial: true, isActive: true, displayOrder: editorialLists.length },
      });
    }

    setName("");
    reexecuteEditorial({ requestPolicy: "network-only" });
    reexecuteAll({ requestPolicy: "network-only" });
  }

  async function toggleEditorial(listId: string, isCurrentlyEditorial: boolean) {
    await executeSetEditorial({
      input: { listId, isEditorial: !isCurrentlyEditorial },
    });
    reexecuteEditorial({ requestPolicy: "network-only" });
    reexecuteAll({ requestPolicy: "network-only" });
  }

  async function toggleActive(listId: string, isCurrentlyActive: boolean) {
    await executeSetEditorial({
      input: { listId, isEditorial: true, isActive: !isCurrentlyActive },
    });
    reexecuteEditorial({ requestPolicy: "network-only" });
  }

  async function updateDisplayOrder(listId: string, displayOrder: number) {
    await executeSetEditorial({
      input: { listId, isEditorial: true, displayOrder },
    });
    reexecuteEditorial({ requestPolicy: "network-only" });
  }

  async function handleDelete(listId: string) {
    await executeDelete({ input: { listId } });
    reexecuteEditorial({ requestPolicy: "network-only" });
    reexecuteAll({ requestPolicy: "network-only" });
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-8">
      <h2 className="text-xs uppercase tracking-widest text-curtn-muted">
        Admin: Editorial Lists
      </h2>

      {/* Quick create editorial list */}
      <div className="border border-curtn-dark bg-curtn-surface p-4 space-y-3">
        <p className="text-xs uppercase tracking-widest text-curtn-muted">Create Editorial List</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="List name..."
            className="flex-1 border border-curtn-dark bg-curtn-deep px-3 py-1.5 text-sm text-curtn-cream placeholder:text-curtn-muted/40 focus:border-curtn-muted/50 focus:outline-none"
          />
          <select
            value={listType}
            onChange={(e) => setListType(e.target.value)}
            className="border border-curtn-dark bg-curtn-deep px-3 py-1.5 text-sm text-curtn-cream focus:outline-none cursor-pointer"
          >
            {LIST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleQuickCreate}
            disabled={!name.trim()}
            className="bg-curtn-coral px-4 py-1.5 text-xs font-semibold text-curtn-deep uppercase tracking-wider hover:bg-curtn-red disabled:opacity-40 cursor-pointer"
          >
            Create
          </button>
        </div>
        {error && <p className="text-xs text-curtn-coral">{error}</p>}
      </div>

      {/* Current editorial lists */}
      <section>
        <h3 className="text-xs uppercase tracking-widest text-curtn-muted mb-3">
          Active Editorial Lists ({editorialLists.length})
        </h3>

        {editorialFetching ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-curtn-dark/30 animate-pulse" />
            ))}
          </div>
        ) : editorialLists.length === 0 ? (
          <p className="text-xs text-curtn-muted/50">No editorial lists yet</p>
        ) : (
          <div className="space-y-1">
            {editorialLists.map((list: any) => (
              <div key={list.id} className="flex items-center justify-between border border-curtn-dark/50 bg-curtn-surface px-3 py-2">
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    defaultValue={list.displayOrder ?? 0}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val !== list.displayOrder) {
                        updateDisplayOrder(list.id, val);
                      }
                    }}
                    className="w-12 border border-curtn-dark bg-curtn-deep px-1.5 py-0.5 text-xs text-curtn-cream text-center focus:border-curtn-muted/50 focus:outline-none"
                    title="Display order (lower = first)"
                  />
                  <button
                    type="button"
                    onClick={() => toggleActive(list.id, list.isActive)}
                    className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 cursor-pointer transition-colors ${
                      list.isActive
                        ? "bg-curtn-acid/20 text-curtn-acid"
                        : "bg-curtn-dark/60 text-curtn-muted/50"
                    }`}
                    title={list.isActive ? "Active — visible on browse" : "Inactive — hidden from browse"}
                  >
                    {list.isActive ? "Active" : "Inactive"}
                  </button>
                  <span className="text-[10px] uppercase tracking-wider text-curtn-muted bg-curtn-dark/60 px-1.5 py-0.5">
                    {list.listType}
                  </span>
                  <Link
                    href={`/u/${list.owner.username}/lists/${list.slug}`}
                    className="text-sm text-curtn-cream hover:text-curtn-coral transition-colors"
                  >
                    {list.name}
                  </Link>
                  <span className="text-[10px] text-curtn-muted/50">{list.itemCount} items</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleEditorial(list.id, true)}
                    className="text-[10px] text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer"
                  >
                    Remove from browse
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(list.id)}
                    className="p-1 text-curtn-muted/50 hover:text-curtn-coral transition-colors cursor-pointer"
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* All my lists — promote to editorial */}
      <section>
        <h3 className="text-xs uppercase tracking-widest text-curtn-muted mb-3">
          Your Lists (promote to editorial)
        </h3>

        {allFetching ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-curtn-dark/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {allLists
              .filter((l: any) => !l.isEditorial)
              .map((list: any) => (
                <div key={list.id} className="flex items-center justify-between border border-curtn-dark/30 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-wider text-curtn-muted/50 bg-curtn-dark/40 px-1.5 py-0.5">
                      {list.listType}
                    </span>
                    <span className="text-sm text-curtn-muted">{list.name}</span>
                    <span className="text-[10px] text-curtn-muted/50">{list.itemCount} items</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleEditorial(list.id, false)}
                    className="text-[10px] text-curtn-coral hover:text-curtn-red transition-colors cursor-pointer"
                  >
                    Add to browse
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
