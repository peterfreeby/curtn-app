"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "urql";
import { Icon } from "@/components/icons/Icons";
import { MY_LISTS_QUERY, LIST_ADD_ITEM_MUTATION } from "@/lib/graphql/lists";
import { useAuth } from "@/lib/auth/useAuth";

interface AddToListButtonProps {
  itemId: string;
  listType: string;
}

export function AddToListButton({ itemId, listType }: AddToListButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const [{ data, fetching }] = useQuery({
    query: MY_LISTS_QUERY,
    variables: { first: 50, listType },
    pause: !open || !user,
  });

  const [, executeAddItem] = useMutation(LIST_ADD_ITEM_MUTATION);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!user) return null;

  async function handleAdd(listId: string) {
    const result = await executeAddItem({
      input: { listId, itemId },
    });

    if (result.data?.listAddItem?.error) {
      setFeedback(result.data.listAddItem.error);
    } else {
      setFeedback("Added!");
    }

    setTimeout(() => {
      setFeedback(null);
      setOpen(false);
    }, 1200);
  }

  const lists = (data?.myLists?.edges?.map((e: any) => e.node) ?? []).filter(Boolean);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex h-10 items-center gap-2 border border-curtn-dark px-4 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream cursor-pointer"
      >
        <Icon name="list-bullets" size={16} />
        Add to list
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 border border-curtn-dark bg-curtn-surface shadow-lg">
          <div className="px-3 py-2 border-b border-curtn-dark/50">
            <p className="text-[10px] uppercase tracking-wider text-curtn-muted">
              Your {listType} lists
            </p>
          </div>

          {fetching && (
            <div className="px-3 py-4 flex justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
            </div>
          )}

          {!fetching && lists.length === 0 && (
            <div className="px-3 py-3 text-center">
              <p className="text-xs text-curtn-muted/70">No {listType} lists yet</p>
              <a
                href="/lists/new"
                className="mt-1.5 inline-block text-xs text-curtn-coral hover:text-curtn-red transition-colors"
              >
                Create one
              </a>
            </div>
          )}

          {!fetching && lists.length > 0 && (
            <div className="max-h-48 overflow-y-auto">
              {lists.map((list: any) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => handleAdd(list.id)}
                  className="w-full px-3 py-2 text-left text-xs text-curtn-cream transition-colors hover:bg-curtn-dark/40 cursor-pointer"
                >
                  <span className="block truncate">{list.name}</span>
                  <span className="text-[10px] text-curtn-muted/50">{list.itemCount} items</span>
                </button>
              ))}
            </div>
          )}

          {feedback && (
            <div className="px-3 py-2 border-t border-curtn-dark/50 text-center">
              <p className="text-xs text-curtn-coral">{feedback}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
