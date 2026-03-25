"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "urql";
import { LIST_BY_SLUG_QUERY, LIST_ITEMS_QUERY, LIST_DELETE_MUTATION, LIST_REMOVE_ITEM_MUTATION } from "@/lib/graphql/lists";
import { ListHeader } from "@/components/lists/ListHeader";
import { ListItemRow } from "@/components/lists/ListItemRow";

export default function ListDetailPage() {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [{ data, fetching, error: queryError }, reexecute] = useQuery({
    query: LIST_BY_SLUG_QUERY,
    variables: { ownerUsername: username, slug },
  });

  const [{ data: itemsData, fetching: itemsFetching, error: itemsError }, reexecuteItems] = useQuery({
    query: LIST_ITEMS_QUERY,
    variables: { ownerUsername: username, slug },
  });

  const [, executeDelete] = useMutation(LIST_DELETE_MUTATION);
  const [, executeRemoveItem] = useMutation(LIST_REMOVE_ITEM_MUTATION);

  const list = data?.listBySlug;

  if (queryError) {
    console.error("ListBySlug query error:", queryError.message, queryError.graphQLErrors);
  }
  if (itemsError) {
    console.error("ListItems query error:", itemsError.message, itemsError.graphQLErrors);
  }

  if (fetching) {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto space-y-4">
        <div className="h-6 w-48 bg-curtn-dark/30 animate-pulse" />
        <div className="h-4 w-32 bg-curtn-dark/30 animate-pulse" />
        <div className="space-y-3 mt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-curtn-dark/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto">
        <div className="empty-state">
          <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">List Not Found</p>
          <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">
            This list doesn&apos;t exist, is private, or has been deleted.
          </p>
        </div>
      </div>
    );
  }

  const collaborators = list.collaborators?.edges?.map((e: any) => e.node) ?? [];
  const itemsList = itemsData?.listBySlug?.items?.edges?.map((e: any) => e.node) ?? [];
  const canEdit = list.isOwner || list.isCollaborator;

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    const result = await executeDelete({ input: { listId: list.id } });
    if (result.data?.listDelete?.success) {
      router.push("/my-lists");
    }
  }

  async function handleRemoveItem(itemId: string) {
    await executeRemoveItem({ input: { listId: list.id, itemId } });
    reexecute({ requestPolicy: "network-only" });
    reexecuteItems({ requestPolicy: "network-only" });
  }

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto space-y-6">
      <ListHeader
        name={list.name}
        description={list.description}
        listType={list.listType}
        isPublic={list.isPublic}
        itemCount={list.itemCount}
        owner={list.owner}
        collaborators={collaborators}
        isOwner={list.isOwner}
        isCollaborator={list.isCollaborator}
        onDelete={handleDelete}
      />

      {confirmDelete && (
        <div className="border border-curtn-coral/50 bg-curtn-surface p-4">
          <p className="text-sm text-curtn-cream mb-3">
            Delete &ldquo;{list.name}&rdquo;? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="bg-curtn-coral px-4 py-1.5 text-xs font-semibold text-curtn-deep uppercase tracking-wider cursor-pointer"
            >
              Confirm Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="border border-curtn-dark px-4 py-1.5 text-xs text-curtn-muted cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <section>
        {itemsFetching && (
          <div className="mt-3 flex justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
          </div>
        )}

        {!itemsFetching && itemsList.length === 0 ? (
          <div className="empty-state">
            <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">No Items Yet</p>
            <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">
              {canEdit
                ? "Browse and add items using the \"Add to list\" button."
                : "This list is empty."}
            </p>
          </div>
        ) : !itemsFetching && (
          <div>
            {itemsList.map((item: any) => (
              <ListItemRow
                key={item.id}
                item={item}
                listType={list.listType}
                canEdit={canEdit}
                onRemove={() => {
                  const i = item.item;
                  const entityId = i?.showId || i?.venueId || i?.personId || i?.runId || i?.perfId;
                  if (entityId) handleRemoveItem(entityId);
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
