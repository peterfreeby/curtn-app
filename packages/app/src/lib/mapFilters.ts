export type DateFilter =
  | "all"
  | "today"
  | "weekend"
  | "week"
  | "next-week"
  | "yesterday"
  | "last-week"
  | "last-month";

export type FilterSection = "all" | "upcoming" | "past";

export const SECTION_ORDER: FilterSection[] = ["all", "upcoming", "past"];

export const SECTION_LABELS: Record<FilterSection, string> = {
  all: "Everything",
  upcoming: "Upcoming",
  past: "Past",
};

export const DATE_FILTERS: { key: DateFilter; label: string; titleLabel: string; section: FilterSection }[] = [
  { key: "all", label: "All", titleLabel: "All Performances", section: "all" },
  { key: "today", label: "Tonight", titleLabel: "Tonight", section: "upcoming" },
  { key: "weekend", label: "This Weekend", titleLabel: "This Weekend", section: "upcoming" },
  { key: "week", label: "This Week", titleLabel: "This Week", section: "upcoming" },
  { key: "next-week", label: "Next Week", titleLabel: "Next Week", section: "upcoming" },
  { key: "yesterday", label: "Yesterday", titleLabel: "Yesterday", section: "past" },
  { key: "last-week", label: "Last Week", titleLabel: "Last Week", section: "past" },
  { key: "last-month", label: "Last Month", titleLabel: "Last Month", section: "past" },
];

export function getActiveFilter(key: string | null | undefined) {
  return DATE_FILTERS.find((f) => f.key === key) ?? DATE_FILTERS[0];
}

export function getDateRange(filter: DateFilter): { start: Date; end: Date } | null {
  if (filter === "all") return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay();

  switch (filter) {
    case "today": {
      const end = new Date(today);
      end.setDate(end.getDate() + 1);
      return { start: today, end };
    }
    case "weekend": {
      const saturday = new Date(today);
      saturday.setDate(saturday.getDate() + (6 - dayOfWeek));
      const monday = new Date(saturday);
      monday.setDate(monday.getDate() + 2);
      return { start: dayOfWeek >= 5 ? today : saturday, end: monday };
    }
    case "week": {
      const endOfWeek = new Date(today);
      endOfWeek.setDate(endOfWeek.getDate() + (7 - dayOfWeek));
      return { start: today, end: endOfWeek };
    }
    case "next-week": {
      const nextMonday = new Date(today);
      nextMonday.setDate(nextMonday.getDate() + (8 - dayOfWeek));
      const nextSunday = new Date(nextMonday);
      nextSunday.setDate(nextSunday.getDate() + 7);
      return { start: nextMonday, end: nextSunday };
    }
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: today };
    }
    case "last-week": {
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      return { start, end: today };
    }
    case "last-month": {
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      return { start, end: today };
    }
  }
}
