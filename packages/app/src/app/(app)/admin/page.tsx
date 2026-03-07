"use client";

import Link from "next/link";
import { Card } from "@/components/Card";

export default function AdminPage() {
  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-curtn-cream">Admin</h1>
        <p className="mt-1 text-sm text-curtn-muted">Data pipeline and management tools.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/import">
          <Card className="transition-colors hover:border-curtn-muted/30 cursor-pointer">
            <h2 className="text-sm font-medium text-curtn-cream">CSV Import</h2>
            <p className="mt-1 text-xs text-curtn-muted/60">
              Bulk import shows, runs, and performances from a CSV file.
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

        <Link href="/admin/editor">
          <Card className="transition-colors hover:border-curtn-muted/30 cursor-pointer">
            <h2 className="text-sm font-medium text-curtn-cream">Data Editor</h2>
            <p className="mt-1 text-xs text-curtn-muted/60">
              Browse and edit shows, venues, runs, and performances.
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
