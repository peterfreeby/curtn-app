"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "urql";
import { Icon } from "@/components/icons/Icons";
import {
  MY_LISTS_QUERY,
  LIST_ADD_ITEM_MUTATION,
  LIST_CREATE_MUTATION,
} from "@/lib/graphql/lists";
import { useAuth } from "@/lib/auth/useAuth";

function AddToListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemId = searchParams.get("itemId");
  const listType = searchParams.get("listType") ?? "shows";

  const { user, isLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [feedback, setFeedback] = useState<{ listId: string; message: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const createRef = useRef<HTMLInputElement>(null);

  const [{ data, fetching }] = useQuery({
    query: MY_LISTS_QUERY,
    variables: { first: 50, listType },
    pause: !user,
  });

  const [, executeAddItem] = useMutation(LIST_ADD_ITEM_MUTATION);
  const [{ fetching: creatingList }, executeCreate] = useMutation(LIST_CREATE_MUTATION);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!itemId) router.back();
  }, [itemId, router]);

  useEffect(() => {
    if (creating) createRef.current?.focus();
  }, [creating]);

  const lists = (data?.myLists?.edges?.map((e: any) => e.node) ?? []) as any[];

  const filtered = searchQuery.trim()
    ? lists.filter((l: any) =>
        l.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : lists;

  const goBack = useCallback(() => router.back(), [router]);

  const handleAdd = useCallback(
    async (listId: string, listName: string) => {
      if (!itemId) return;
      const result = await executeAddItem({ input: { listId, itemId } });

      if (result.data?.listAddItem?.error) {
        setFeedback({ listId, message: result.data.listAddItem.error });
        setTimeout(() => setFeedback(null), 2000);
      } else {
        setFeedback({ listId, message: "Added!" });
        setTimeout(() => goBack(), 600);
      }
    },
    [executeAddItem, itemId, goBack]
  );

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newListName.trim()) return;

      const result = await executeCreate({
        input: {
          name: newListName.trim(),
          listType,
          isPublic: true,
        },
      });

      if (result.error || result.data?.listCreate?.error) {
        setFeedback({
          listId: "__create",
          message: result.error?.message || result.data?.listCreate?.error || "Failed to create",
        });
        setTimeout(() => setFeedback(null), 2000);
        return;
      }

      const newList = result.data?.listCreate?.list;
      if (newList) {
        await handleAdd(newList.id, newList.name);
      }
    },
    [newListName, listType, executeCreate, handleAdd]
  );

  if (isLoading || !itemId) return null;

  return (
    <div className="px-5">
      {/* Search bar + close — in-flow so keyboard resize works naturally */}
      <div className="flex items-center justify-center gap-2 pb-4">
        <div className="nav-bar nav-bar-floating inline-flex">
          <div className="relative p-0.5 flex items-center justify-center" style={{ minHeight: 34 }}>
            <div className="flex items-center gap-2 pl-3" style={{ width: 260 }}>
              <Icon name="magnifying-glass" size={16} className="text-curtn-muted shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search lists..."
                className="flex-1 bg-transparent text-base text-curtn-cream placeholder:text-curtn-muted/50 outline-none py-1 min-w-0"
                autoFocus
              />
              <button
                type="button"
                onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }}
                className="flex items-center justify-center w-7 h-7 rounded-full text-curtn-muted hover:text-curtn-cream shrink-0 transition-opacity"
                style={{ opacity: searchQuery ? 1 : 0, pointerEvents: searchQuery ? "auto" : "none" }}
                aria-label="Clear search"
              >
                <Icon name="plus" weight="regular" size={14} className="rotate-45" />
              </button>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={goBack}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-curtn-coral text-curtn-deep hover:bg-curtn-red active:scale-95 shadow-[0_4px_20px_rgba(17,17,17,0.2)] shrink-0"
          aria-label="Close"
        >
          <Icon name="plus" weight="bold" size={20} className="rotate-45" />
        </button>
      </div>

      {/* Header */}
      <div className="px-1 pb-3">
        <h1 className="text-xs uppercase tracking-widest text-curtn-muted">
          Save to a list
        </h1>
        <p className="mt-1 text-sm text-curtn-cream/70">
          Choose a list or create a new one.
        </p>
      </div>

      {/* List area */}
      <div className="px-1">
        {/* Create new list */}
        {creating ? (
          <form onSubmit={handleCreate} className="mb-3 border border-curtn-dark/50 bg-curtn-surface p-3">
            <label className="block text-[10px] uppercase tracking-widest text-curtn-muted mb-1.5">
              New {listType} list
            </label>
            <input
              ref={createRef}
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="List name..."
              className="w-full border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream placeholder:text-curtn-muted/40 focus:border-curtn-muted/50 focus:outline-none"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                disabled={creatingList || !newListName.trim()}
                className="flex-1 bg-curtn-coral py-2 text-xs font-semibold text-curtn-deep uppercase tracking-wider hover:bg-curtn-red disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {creatingList ? "Creating..." : "Create & add"}
              </button>
              <button
                type="button"
                onClick={() => { setCreating(false); setNewListName(""); }}
                className="px-3 py-2 text-xs text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
            {feedback?.listId === "__create" && (
              <p className="mt-1.5 text-xs text-curtn-coral">{feedback.message}</p>
            )}
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full mb-3 flex items-center gap-2 px-3 py-3 text-sm text-curtn-coral hover:bg-curtn-cream/5 transition-colors cursor-pointer border border-dashed border-curtn-dark/50"
          >
            <Icon name="plus" weight="bold" size={16} />
            <span>Create new list</span>
          </button>
        )}

        {/* Loading */}
        {fetching && (
          <div className="py-8 flex justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
          </div>
        )}

        {/* Empty state */}
        {!fetching && filtered.length === 0 && !creating && (
          <div className="py-8 text-center">
            <p className="text-sm text-curtn-muted/70">
              {searchQuery
                ? `No lists matching "${searchQuery}"`
                : `No ${listType} lists yet`}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="mt-2 text-sm text-curtn-coral hover:text-curtn-red transition-colors cursor-pointer"
              >
                Create your first one
              </button>
            )}
          </div>
        )}

        {/* List rows */}
        {!fetching &&
          filtered.map((list: any) => (
            <button
              key={list.id}
              type="button"
              onClick={() => handleAdd(list.id, list.name)}
              disabled={feedback?.listId === list.id}
              className="w-full flex items-center justify-between px-3 py-3 text-left transition-colors hover:bg-curtn-cream/5 cursor-pointer border-b border-curtn-dark/20 last:border-b-0"
            >
              <div className="min-w-0">
                <span className="block text-sm text-curtn-cream truncate">
                  {list.name}
                </span>
                <span className="text-[10px] text-curtn-muted/50">
                  {list.itemCount} {list.itemCount === 1 ? "item" : "items"}
                </span>
              </div>
              {feedback && feedback.listId === list.id ? (
                <span className="text-xs text-curtn-coral shrink-0">{feedback.message}</span>
              ) : (
                <Icon name="plus" weight="regular" size={16} className="text-curtn-muted/40 shrink-0" />
              )}
            </button>
          ))}
      </div>
    </div>
  );
}

export default function AddToListPage() {
  return (
    <Suspense>
      <AddToListContent />
    </Suspense>
  );
}
