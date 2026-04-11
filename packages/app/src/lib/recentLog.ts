const STORAGE_KEY = "curtn_recent_log";
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export interface RecentLog {
  runId: string;
  showTitle: string;
  venueName: string | null;
  rating: number;
  timestamp: number;
}

export function saveRecentLog(log: Omit<RecentLog, "timestamp">) {
  try {
    const entry: RecentLog = { ...log, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage unavailable
  }
}

export function getRecentLog(): RecentLog | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const entry: RecentLog = JSON.parse(raw);
    if (Date.now() - entry.timestamp > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

export function clearRecentLog() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}
