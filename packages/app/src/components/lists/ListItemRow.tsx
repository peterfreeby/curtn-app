"use client";

import Link from "next/link";
import { Icon } from "@/components/icons/Icons";

interface ListItemRowProps {
  item: any;
  listType: string;
  canEdit: boolean;
  onRemove?: () => void;
}

function getItemLink(item: any): string {
  switch (item.__typename) {
    case "Show":
      return `/performances/${encodeURIComponent(item.showId)}`;
    case "Venue":
      return `/venues/${item.venueSlug}`;
    case "Person":
      return `/people/${item.personSlug}`;
    case "Run":
      return `/runs/${encodeURIComponent(item.runId)}`;
    case "Performance":
      return `/performances/${encodeURIComponent(item.perfId)}`;
    default:
      return "#";
  }
}

function getItemDisplay(item: any) {
  switch (item.__typename) {
    case "Show":
      return {
        title: item.showTitle,
        subtitle: item.performanceTypes?.join(", "),
        image: item.posterUrl || item.imageUrl,
      };
    case "Venue":
      return {
        title: item.venueName,
        subtitle: [item.city, item.state].filter(Boolean).join(", "),
        image: item.venueImageUrl,
      };
    case "Person":
      return {
        title: item.personName,
        subtitle: null,
        image: item.headshotUrl,
      };
    case "Run":
      return {
        title: item.runTitle || "Run",
        subtitle: [item.startDate, item.endDate].filter(Boolean).join(" – "),
        image: null,
      };
    case "Performance":
      return {
        title: `${item.date || "Performance"}`,
        subtitle: item.time || null,
        image: null,
      };
    default:
      return { title: "Unknown", subtitle: null, image: null };
  }
}

function getItemId(item: any): string {
  return item.showId || item.venueId || item.personId || item.runId || item.perfId || "";
}

export function ListItemRow({ item, listType, canEdit, onRemove }: ListItemRowProps) {
  if (!item.item) return null;

  const display = getItemDisplay(item.item);
  const href = getItemLink(item.item);
  const isAvatar = item.item.__typename === "Person";

  return (
    <div className="flex items-center gap-3 border-b border-curtn-dark/30 py-3 last:border-b-0">
      {display.image && (
        <Link href={href} className="shrink-0">
          <img
            src={display.image}
            alt={display.title}
            className={`h-12 w-12 object-cover bg-curtn-dark/20 ${isAvatar ? "rounded-full" : ""}`}
          />
        </Link>
      )}

      <div className="flex-1 min-w-0">
        <Link href={href} className="block">
          <p className="text-sm font-semibold text-curtn-cream truncate hover:text-curtn-coral transition-colors">
            {display.title}
          </p>
          {display.subtitle && (
            <p className="text-xs text-curtn-muted truncate">{display.subtitle}</p>
          )}
        </Link>
        {item.note && (
          <p className="mt-0.5 text-[11px] text-curtn-muted/70 italic truncate">{item.note}</p>
        )}
      </div>

      {canEdit && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 p-1.5 text-curtn-muted/50 transition-colors hover:text-curtn-coral cursor-pointer"
          title="Remove from list"
        >
          <Icon name="trash" size={14} />
        </button>
      )}
    </div>
  );
}
