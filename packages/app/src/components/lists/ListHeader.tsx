"use client";

import Link from "next/link";
import { Icon } from "@/components/icons/Icons";
import { LIST_TYPE_LABELS } from "./ListCard";

interface ListHeaderProps {
  name: string;
  description?: string | null;
  listType: string;
  isPublic: boolean;
  itemCount: number;
  owner: {
    username: string;
    fullName: string;
    avatarUrl?: string | null;
  };
  collaborators: Array<{
    username: string;
    fullName: string;
    avatarUrl?: string | null;
  }>;
  isOwner: boolean;
  isCollaborator: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ListHeader({
  name,
  description,
  listType,
  isPublic,
  itemCount,
  owner,
  collaborators,
  isOwner,
  isCollaborator,
  onEdit,
  onDelete,
}: ListHeaderProps) {
  return (
    <div className="border-b border-curtn-dark/50 pb-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block bg-curtn-dark/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted">
          {LIST_TYPE_LABELS[listType] ?? listType}
        </span>
        {!isPublic && (
          <span className="inline-block bg-curtn-dark/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted/70">
            Private
          </span>
        )}
        <span className="text-[10px] text-curtn-muted/50">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>

      <h1 className="font-display text-xl font-bold uppercase tracking-wide text-curtn-cream">
        {name}
      </h1>

      {description && (
        <p className="mt-2 text-sm text-curtn-muted">{description}</p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <Link
          href={`/u/${owner.username}`}
          className="flex items-center gap-1.5 text-xs text-curtn-muted hover:text-curtn-cream transition-colors"
        >
          {owner.avatarUrl ? (
            <img src={owner.avatarUrl} alt={owner.username} className="h-5 w-5 rounded-full object-cover" />
          ) : (
            <Icon name="user" size={14} className="text-curtn-muted/50" />
          )}
          <span>@{owner.username}</span>
        </Link>

        {collaborators.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-curtn-muted/70">
            <Icon name="users-three" size={14} className="text-curtn-muted/50" />
            <span>{collaborators.length} collaborator{collaborators.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {(isOwner || isCollaborator) && (
        <div className="mt-4 flex items-center gap-2">
          {isOwner && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1.5 border border-curtn-dark px-3 py-1.5 text-xs text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream cursor-pointer"
            >
              <Icon name="pencil" size={12} />
              Edit
            </button>
          )}
          {isOwner && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 border border-curtn-dark px-3 py-1.5 text-xs text-curtn-muted transition-colors hover:border-curtn-coral/50 hover:text-curtn-coral cursor-pointer"
            >
              <Icon name="trash" size={12} />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
