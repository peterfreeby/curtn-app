"use client";

import { useState } from "react";
import { useQuery, useMutation } from "urql";
import Link from "next/link";
import {
  MY_LISTS_QUERY,
  LIST_CREATE_MUTATION,
  LIST_SET_EDITORIAL_MUTATION,
  LIST_DELETE_MUTATION,
  ADMIN_EDITORIAL_LISTS_QUERY,
  COMBINABLE_LISTS_QUERY,
} from "@/lib/graphql/lists";
import { Icon } from "@/components/icons/Icons";
import { EntitySourcePicker } from "@/components/admin/EntitySourcePicker";
import { InfiniteList } from "@/components/admin/InfiniteList";

const LIST_TYPES = [
  { value: "shows", label: "Shows" },
  { value: "venues", label: "Venues" },
  { value: "runs", label: "Runs" },
  { value: "performances", label: "Performances" },
  { value: "people", label: "People" },
];

const SOURCE_MODES = [
  { value: "manual", label: "Manual (hand-picked)" },
  { value: "entity", label: "Auto — all shows from one entity" },
  { value: "follows", label: "Auto — shows from entities I follow" },
  { value: "combined", label: "Combined — other lists, filtered by date" },
];

// Baked date windows for combined lists. Mirrors LIST_DATE_WINDOWS on the server.
const DATE_WINDOWS = [
  { value: "tonight", label: "Tonight" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "this_weekend", label: "This Weekend" },
  { value: "this_week", label: "This Week" },
  { value: "next_week", label: "Next Week" },
  { value: "this_month", label: "This Month" },
];

const WINDOW_LABEL: Record<string, string> = Object.fromEntries(
  DATE_WINDOWS.map((w) => [w.value, w.label]),
);

const ENTITY_TYPES = [
  { value: "venue", label: "Venue" },
  { value: "person", label: "Person" },
  { value: "productionCompany", label: "Production company" },
];

type SourceEntityType = "venue" | "person" | "productionCompany";

function sourceLabel(list: any): string {
  if (list.sourceMode === "entity") {
    return `Auto · ${list.sourceEntityName ?? list.sourceEntityType ?? "entity"}`;
  }
  if (list.sourceMode === "follows") {
    return `Auto · ${list.followTargetType ?? "entities"} I follow`;
  }
  if (list.sourceMode === "combined") {
    const window = WINDOW_LABEL[list.dateWindow] ?? list.dateWindow ?? "no window";
    const count = list.sourceListIds?.length ?? 0;
    return `Combined · ${window} · ${count} list${count === 1 ? "" : "s"}`;
  }
  return `${list.itemCount} items`;
}

export default function AdminListsPage() {
  const [name, setName] = useState("");
  const [listType, setListType] = useState("shows");
  const [sourceMode, setSourceMode] = useState("manual");
  const [sourceEntityType, setSourceEntityType] = useState<SourceEntityType>("venue");
  const [selectedEntity, setSelectedEntity] = useState<{ id: string; name: string } | null>(null);
  const [followTargetType, setFollowTargetType] = useState<SourceEntityType>("person");
  const [dateWindow, setDateWindow] = useState("this_weekend");
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Show-type editorial lists available as combined-list sources.
  const [{ data: combinableData }] = useQuery({
    query: COMBINABLE_LISTS_QUERY,
    variables: { first: 200 },
  });
  const combinableLists = combinableData?.editorialLists?.edges
    ?.map((e: any) => e.node)
    // A combined list can't source itself or another combined list.
    ?.filter((l: any) => l.sourceMode !== "combined") ?? [];

  // Active editorial lists (mirrors the browse query). Small, complete, always shown
  // first in the merged editorial scroll area — never crowded out by the inactive pile.
  const [{ data: activeData, fetching: activeFetching }, reexecuteActive] = useQuery({
    query: ADMIN_EDITORIAL_LISTS_QUERY,
    variables: { activeOnly: true, first: 200 },
  });

  // Bumped after any mutation to reset the infinite-scroll lists to their first page.
  const [refreshTick, setRefreshTick] = useState(0);
  function refreshLists() {
    reexecuteActive({ requestPolicy: "network-only" });
    setRefreshTick((t) => t + 1);
  }

  const [, executeCreate] = useMutation(LIST_CREATE_MUTATION);
  const [, executeSetEditorial] = useMutation(LIST_SET_EDITORIAL_MUTATION);
  const [, executeDelete] = useMutation(LIST_DELETE_MUTATION);

  const activeLists = activeData?.editorialLists?.edges?.map((e: any) => e.node) ?? [];

  async function handleQuickCreate() {
    if (!name.trim()) return;
    setError(null);

    // Dynamic lists are always lists of shows.
    const effectiveListType = sourceMode === "manual" ? listType : "shows";

    const input: any = {
      name: name.trim(),
      listType: effectiveListType,
      isPublic: true,
      sourceMode,
    };

    if (sourceMode === "entity") {
      if (!selectedEntity) {
        setError("Pick an entity to source shows from.");
        return;
      }
      input.sourceEntityType = sourceEntityType;
      input.sourceEntityId = selectedEntity.id;
    }

    if (sourceMode === "follows") {
      input.followTargetType = followTargetType;
    }

    if (sourceMode === "combined") {
      if (selectedListIds.length === 0) {
        setError("Pick at least one source list to combine.");
        return;
      }
      input.dateWindow = dateWindow;
      input.sourceListIds = selectedListIds;
    }

    const result = await executeCreate({ input });

    if (result.data?.listCreate?.error) {
      setError(result.data.listCreate.error);
      return;
    }

    const newList = result.data?.listCreate?.list;
    if (newList) {
      await executeSetEditorial({
        input: { listId: newList.id, isEditorial: true, isActive: true, displayOrder: activeLists.length },
      });
    }

    setName("");
    setSelectedEntity(null);
    setSelectedListIds([]);
    setSourceMode("manual");
    refreshLists();
  }

  function toggleSourceList(id: string) {
    setSelectedListIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  async function toggleEditorial(listId: string, isCurrentlyEditorial: boolean) {
    await executeSetEditorial({
      input: { listId, isEditorial: !isCurrentlyEditorial },
    });
    refreshLists();
  }

  async function toggleActive(listId: string, isCurrentlyActive: boolean) {
    await executeSetEditorial({
      input: { listId, isEditorial: true, isActive: !isCurrentlyActive },
    });
    refreshLists();
  }

  async function updateDisplayOrder(listId: string, displayOrder: number) {
    await executeSetEditorial({
      input: { listId, isEditorial: true, displayOrder },
    });
    refreshLists();
  }

  async function handleDelete(listId: string) {
    await executeDelete({ input: { listId } });
    refreshLists();
  }

  function renderEditorialRow(list: any) {
    return (
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
          <span className="text-[10px] text-curtn-muted/50">{sourceLabel(list)}</span>
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
    );
  }

  function renderYourListRow(list: any) {
    return (
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
    );
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
            value={sourceMode}
            onChange={(e) => { setSourceMode(e.target.value); setError(null); }}
            className="border border-curtn-dark bg-curtn-deep px-3 py-1.5 text-sm text-curtn-cream focus:outline-none cursor-pointer"
            title="How this list is populated"
          >
            {SOURCE_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Mode-specific controls */}
        {sourceMode === "manual" && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-curtn-muted">Item type</span>
            <select
              value={listType}
              onChange={(e) => setListType(e.target.value)}
              className="border border-curtn-dark bg-curtn-deep px-3 py-1.5 text-sm text-curtn-cream focus:outline-none cursor-pointer"
            >
              {LIST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <span className="text-[10px] text-curtn-muted/50">Add items by hand on the list page.</span>
          </div>
        )}

        {sourceMode === "entity" && (
          <div className="flex items-center gap-2">
            <select
              value={sourceEntityType}
              onChange={(e) => { setSourceEntityType(e.target.value as SourceEntityType); setSelectedEntity(null); }}
              className="border border-curtn-dark bg-curtn-deep px-3 py-1.5 text-sm text-curtn-cream focus:outline-none cursor-pointer"
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <EntitySourcePicker
              entityType={sourceEntityType}
              value={selectedEntity}
              onChange={setSelectedEntity}
            />
          </div>
        )}

        {sourceMode === "follows" && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-curtn-muted">Shows from</span>
            <select
              value={followTargetType}
              onChange={(e) => setFollowTargetType(e.target.value as SourceEntityType)}
              className="border border-curtn-dark bg-curtn-deep px-3 py-1.5 text-sm text-curtn-cream focus:outline-none cursor-pointer"
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}s I follow</option>
              ))}
            </select>
            <span className="text-[10px] text-curtn-muted/50">Per-viewer. Hidden when a viewer follows none.</span>
          </div>
        )}

        {sourceMode === "combined" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-curtn-muted">Date window</span>
              <select
                value={dateWindow}
                onChange={(e) => setDateWindow(e.target.value)}
                className="border border-curtn-dark bg-curtn-deep px-3 py-1.5 text-sm text-curtn-cream focus:outline-none cursor-pointer"
              >
                {DATE_WINDOWS.map((w) => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
              <span className="text-[10px] text-curtn-muted/50">Recomputed in NYC time on every browse load.</span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-curtn-muted mb-1">
                Source lists ({selectedListIds.length} selected)
              </p>
              {combinableLists.length === 0 ? (
                <p className="text-[10px] text-curtn-muted/50">
                  No show lists yet — create some show/entity/follows lists first.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto border border-curtn-dark/50 bg-curtn-deep divide-y divide-curtn-dark/30">
                  {combinableLists.map((l: any) => (
                    <label
                      key={l.id}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm text-curtn-cream cursor-pointer hover:bg-curtn-surface"
                    >
                      <input
                        type="checkbox"
                        checked={selectedListIds.includes(l.id)}
                        onChange={() => toggleSourceList(l.id)}
                        className="accent-curtn-coral"
                      />
                      <span>{l.name}</span>
                      <span className="text-[10px] text-curtn-muted/50">{sourceLabel(l)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleQuickCreate}
            disabled={
              !name.trim() ||
              (sourceMode === "entity" && !selectedEntity) ||
              (sourceMode === "combined" && selectedListIds.length === 0)
            }
            className="bg-curtn-coral px-4 py-1.5 text-xs font-semibold text-curtn-deep uppercase tracking-wider hover:bg-curtn-red disabled:opacity-40 cursor-pointer"
          >
            Create
          </button>
        </div>
        {error && <p className="text-xs text-curtn-coral">{error}</p>}
      </div>

      {/* Editorial lists — active first, then inactive streams in on scroll */}
      <section>
        <h3 className="text-xs uppercase tracking-widest text-curtn-muted mb-3">
          Editorial Lists
          <span className="ml-2 text-curtn-muted/50 normal-case tracking-normal">
            {activeLists.length} active on browse
          </span>
        </h3>

        <InfiniteList
          query={ADMIN_EDITORIAL_LISTS_QUERY}
          connectionKey="editorialLists"
          variables={{ isActive: false }}
          renderItem={renderEditorialRow}
          resetKey={refreshTick}
          emptyText="No editorial lists yet — create one above."
          prepend={
            <>
              {activeLists.map(renderEditorialRow)}
              {activeLists.length > 0 && (
                <p className="pt-3 pb-1 text-[10px] uppercase tracking-wider text-curtn-muted/40">
                  Inactive
                </p>
              )}
            </>
          }
        />
      </section>

      {/* All my lists — promote to editorial */}
      <section>
        <h3 className="text-xs uppercase tracking-widest text-curtn-muted mb-3">
          Your Lists (promote to editorial)
        </h3>

        <InfiniteList
          query={MY_LISTS_QUERY}
          connectionKey="myLists"
          variables={{}}
          filter={(l: any) => !l.isEditorial}
          renderItem={renderYourListRow}
          resetKey={refreshTick}
          emptyText="No non-editorial lists."
        />
      </section>
    </div>
  );
}
