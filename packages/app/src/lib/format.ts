/** Format an ISO date string to "Sat, Mar 15" */
export function formatShowDate(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

/** Format a time string for display. Passes through as-is since the API already returns "7:00 PM" format. */
export function formatShowTime(timeStr: string): string {
  return timeStr;
}

/** Format minutes to "2h 40m" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
