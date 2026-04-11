import * as chrono from "chrono-node";

export interface ParsedShowInput {
  showName: string;
  venueName: string | null;
  date: Date | null;
  time: string | null;
  // Track which portions of the original input mapped to what
  chunks: {
    show: { text: string; start: number; end: number } | null;
    venue: { text: string; start: number; end: number } | null;
    datetime: { text: string; start: number; end: number } | null;
  };
}

/**
 * Parse a natural language show input string into structured data.
 *
 * Examples:
 *   "Big Beef at Life World Thursday 7pm"
 *   → { showName: "Big Beef", venueName: "Life World", date: ..., time: "7:00 PM" }
 *
 *   "Big Beef, Life World, April 9"
 *   → { showName: "Big Beef", venueName: "Life World", date: ..., time: null }
 *
 *   "Big Beef"
 *   → { showName: "Big Beef", venueName: null, date: null, time: null }
 */
export function parseShowInput(input: string): ParsedShowInput {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      showName: "",
      venueName: null,
      date: null,
      time: null,
      chunks: { show: null, venue: null, datetime: null },
    };
  }

  // Step 1: Extract date/time with chrono-node
  const chronoResults = chrono.parse(trimmed, new Date(), { forwardDate: true });
  let date: Date | null = null;
  let time: string | null = null;
  let datetimeChunk: { text: string; start: number; end: number } | null = null;

  if (chronoResults.length > 0) {
    const result = chronoResults[0];
    date = result.start.date();
    datetimeChunk = {
      text: result.text,
      start: result.index,
      end: result.index + result.text.length,
    };

    // Extract time if chrono found one (check if hour was explicitly mentioned)
    if (result.start.isCertain("hour")) {
      const hours = result.start.get("hour") ?? 0;
      const minutes = result.start.get("minute") ?? 0;
      const ampm = hours >= 12 ? "PM" : "AM";
      const h = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
      time = `${h}:${String(minutes).padStart(2, "0")} ${ampm}`;
    }
  }

  // Step 2: Remove the datetime portion from the string to parse show/venue
  let remainder = trimmed;
  if (datetimeChunk) {
    remainder =
      trimmed.slice(0, datetimeChunk.start) +
      trimmed.slice(datetimeChunk.end);
    remainder = remainder.replace(/\s+/g, " ").trim();
    // Clean up trailing/leading separators
    remainder = remainder.replace(/[,\s]+$/, "").replace(/^[,\s]+/, "");
  }

  // Step 3: Split remaining text into show name and venue name
  // Try "at" as separator first (most natural: "Big Beef at Life World")
  // Then fall back to comma separator
  let showName = remainder;
  let venueName: string | null = null;

  // Match " at " as venue separator (but not "at" inside words like "theater")
  const atMatch = remainder.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atMatch) {
    showName = atMatch[1].trim();
    venueName = atMatch[2].trim();
  } else {
    // Try comma separator: "Big Beef, Life World"
    const commaMatch = remainder.match(/^(.+?),\s*(.+)$/);
    if (commaMatch) {
      showName = commaMatch[1].trim();
      venueName = commaMatch[2].trim();
    }
  }

  // Clean up venue name — remove trailing separators
  if (venueName) {
    venueName = venueName.replace(/[,\s]+$/, "").trim();
    if (!venueName) venueName = null;
  }

  // Build chunk positions for the original input
  // These are approximate — good enough for highlighting
  const showChunk = showName
    ? { text: showName, start: 0, end: showName.length }
    : null;

  let venueChunk: { text: string; start: number; end: number } | null = null;
  if (venueName) {
    const venueIdx = trimmed.toLowerCase().indexOf(venueName.toLowerCase());
    if (venueIdx >= 0) {
      venueChunk = {
        text: venueName,
        start: venueIdx,
        end: venueIdx + venueName.length,
      };
    }
  }

  return {
    showName: showName.replace(/[,\s]+$/, "").trim(),
    venueName,
    date,
    time,
    chunks: {
      show: showChunk,
      venue: venueChunk,
      datetime: datetimeChunk,
    },
  };
}

/**
 * Format a Date to YYYY-MM-DD for form inputs.
 */
export function formatDateForInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Format a Date to a human-readable string like "Thu, Apr 9"
 */
export function formatDateHuman(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
