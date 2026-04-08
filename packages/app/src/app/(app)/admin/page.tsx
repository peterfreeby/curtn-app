"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/config";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

interface StorageStats {
  totalCount: number;
  totalBytes: number;
  byEntityType: Record<string, { count: number; bytes: number }>;
  monthlyUploads: { count: number; bytes: number };
  estimatedMonthlyCost: number;
  freeTierRemainingBytes: number;
  updatedAt: string;
}

function StorageOdometer() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const token = await auth?.currentUser?.getIdToken();
      const url = `/api/admin/storage-stats${refresh ? "?refresh=true" : ""}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch");
      setStats(await res.json());
    } catch {
      setError("Could not load storage stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <Card className="space-y-3">
        <div className="h-4 w-32 rounded bg-curtn-dark/60 animate-pulse" />
        <div className="h-3 w-48 rounded bg-curtn-dark/40 animate-pulse" />
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card className="space-y-1">
        <h2 className="text-sm font-medium text-curtn-cream">Image Storage</h2>
        <p className="text-xs text-curtn-muted/60">
          {error ?? "No data available"} — configure R2 credentials to enable.
        </p>
      </Card>
    );
  }

  const FREE_TIER = 10 * 1024 * 1024 * 1024;
  const usageRatio = (stats.totalBytes / FREE_TIER) * 100;
  const statusColor =
    usageRatio < 50
      ? "text-green-400"
      : usageRatio < 90
        ? "text-yellow-400"
        : "text-curtn-red";
  const barColor =
    usageRatio < 50
      ? "bg-green-400"
      : usageRatio < 90
        ? "bg-yellow-400"
        : "bg-curtn-red";

  const entityTypes = Object.entries(stats.byEntityType).sort(
    (a, b) => b[1].bytes - a[1].bytes
  );

  const updatedAt = new Date(stats.updatedAt);
  const timeAgo = Math.round((Date.now() - updatedAt.getTime()) / 60000);
  const timeLabel =
    timeAgo < 1 ? "just now" : timeAgo < 60 ? `${timeAgo}m ago` : `${Math.round(timeAgo / 60)}h ago`;

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-medium text-curtn-cream">Image Storage</h2>
          <p className="mt-0.5 text-xs text-curtn-muted/60">Cloudflare R2</p>
        </div>
        <button
          onClick={() => fetchStats(true)}
          className="text-[10px] text-curtn-muted/60 hover:text-curtn-cream transition-colors cursor-pointer"
        >
          Refresh · {timeLabel}
        </button>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className={`text-lg font-bold ${statusColor}`}>
            {stats.totalCount.toLocaleString()}
          </p>
          <p className="text-[10px] text-curtn-muted/60">images stored</p>
        </div>
        <div>
          <p className={`text-lg font-bold ${statusColor}`}>
            {formatBytes(stats.totalBytes)}
          </p>
          <p className="text-[10px] text-curtn-muted/60">total size</p>
        </div>
        <div>
          <p className="text-lg font-bold text-curtn-cream">
            ${stats.estimatedMonthlyCost.toFixed(2)}
          </p>
          <p className="text-[10px] text-curtn-muted/60">est. monthly cost</p>
        </div>
      </div>

      {/* Free tier bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-curtn-muted/60">
          <span>Free tier usage</span>
          <span>
            {formatBytes(stats.freeTierRemainingBytes)} remaining
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-curtn-dark/60 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(usageRatio, 100)}%` }}
          />
        </div>
      </div>

      {/* This month */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-curtn-muted/60">This month:</span>
        <span className="text-curtn-cream">
          +{stats.monthlyUploads.count.toLocaleString()} images
        </span>
        <span className="text-curtn-muted/40">·</span>
        <span className="text-curtn-cream">
          {formatBytes(stats.monthlyUploads.bytes)}
        </span>
      </div>

      {/* Breakdown by entity type */}
      {entityTypes.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-curtn-dark/30">
          <p className="text-[10px] text-curtn-muted/60 uppercase tracking-wide">
            By type
          </p>
          {entityTypes.map(([type, data]) => (
            <div key={type} className="flex justify-between text-xs">
              <span className="text-curtn-muted">{type}</span>
              <span className="text-curtn-cream">
                {data.count.toLocaleString()} · {formatBytes(data.bytes)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function AdminPage() {
  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-curtn-cream">Admin</h1>
        <p className="mt-1 text-sm text-curtn-muted">Data pipeline and management tools.</p>
      </div>

      {/* Storage odometer — always visible */}
      <StorageOdometer />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/import">
          <Card className="transition-colors hover:border-curtn-muted/30 cursor-pointer">
            <h2 className="text-sm font-medium text-curtn-cream">CSV Import</h2>
            <p className="mt-1 text-xs text-curtn-muted/60">
              Bulk import shows, runs, and performances from a CSV file.
            </p>
          </Card>
        </Link>

        <Link href="/admin/wikidata">
          <Card className="transition-colors hover:border-curtn-muted/30 cursor-pointer">
            <h2 className="text-sm font-medium text-curtn-cream">Wikipedia Import</h2>
            <p className="mt-1 text-xs text-curtn-muted/60">
              Search and import shows, venues, and people from Wikipedia &amp; Wikidata.
            </p>
          </Card>
        </Link>

        <Link href="/admin/sources">
          <Card className="transition-colors hover:border-curtn-muted/30 cursor-pointer">
            <h2 className="text-sm font-medium text-curtn-cream">Data Sources</h2>
            <p className="mt-1 text-xs text-curtn-muted/60">
              RSS feeds, iCal subscriptions, and partner integrations.
            </p>
          </Card>
        </Link>

        <Link href="/admin/incoming">
          <Card className="transition-colors hover:border-curtn-muted/30 cursor-pointer">
            <h2 className="text-sm font-medium text-curtn-cream">Incoming Events</h2>
            <p className="mt-1 text-xs text-curtn-muted/60">
              Review, edit, and approve events imported from feeds.
            </p>
          </Card>
        </Link>

        <Link href="/admin/claims">
          <Card className="transition-colors hover:border-curtn-muted/30 cursor-pointer">
            <h2 className="text-sm font-medium text-curtn-cream">Claim Requests</h2>
            <p className="mt-1 text-xs text-curtn-muted/60">
              Review and approve user claims to performer/creator profiles.
            </p>
          </Card>
        </Link>

        <Link href="/admin/editor">
          <Card className="transition-colors hover:border-curtn-muted/30 cursor-pointer">
            <h2 className="text-sm font-medium text-curtn-cream">Data Editor</h2>
            <p className="mt-1 text-xs text-curtn-muted/60">
              Browse and edit shows, venues, runs, and performances.
            </p>
          </Card>
        </Link>

        <Link href="/admin/lists">
          <Card className="transition-colors hover:border-curtn-muted/30 cursor-pointer">
            <h2 className="text-sm font-medium text-curtn-cream">Editorial Lists</h2>
            <p className="mt-1 text-xs text-curtn-muted/60">
              Curate lists that power the browse page.
            </p>
          </Card>
        </Link>

        <Link href="/admin/styleguide">
          <Card className="transition-colors hover:border-curtn-muted/30 cursor-pointer">
            <h2 className="text-sm font-medium text-curtn-cream">Style Guide</h2>
            <p className="mt-1 text-xs text-curtn-muted/60">
              Component library, design tokens, and visual reference.
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
