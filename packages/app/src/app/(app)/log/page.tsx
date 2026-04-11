"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import { LogForm } from "@/components/log/LogForm";
import { SmartLogForm } from "@/components/log/SmartLogForm";
import { RecentlyLogged } from "@/components/log/RecentlyLogged";
import { Card } from "@/components/Card";
import Link from "next/link";

function LogPageContent() {
  const searchParams = useSearchParams();
  const runId = searchParams.get("run");
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="px-6 py-8 max-w-lg mx-auto animate-pulse space-y-4">
        <div className="h-4 w-32 rounded bg-curtn-dark/60" />
        <div className="h-48 rounded-xl bg-curtn-dark/60" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="px-6 py-8 max-w-lg mx-auto">
        <Card className="text-center space-y-4">
          <p className="text-curtn-cream font-medium">Sign in to log a show</p>
          <p className="text-sm text-curtn-muted">
            You need an account to log performances and leave reviews.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-lg bg-curtn-coral px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-curtn-red"
          >
            Sign In
          </Link>
        </Card>
      </div>
    );
  }

  // If arriving from a show page with a run ID, use the existing detailed form
  if (runId) {
    return (
      <div className="px-6 py-8 max-w-lg mx-auto">
        <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-8">
          Log a Performance
        </h2>
        <LogForm runId={runId} />
      </div>
    );
  }

  // Otherwise, use the new smart log form
  return (
    <div className="px-6 py-8">
      <RecentlyLogged />
      <SmartLogForm />
    </div>
  );
}

export default function LogPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 max-w-lg mx-auto animate-pulse space-y-4">
          <div className="h-4 w-32 rounded bg-curtn-dark/60" />
          <div className="h-48 rounded-xl bg-curtn-dark/60" />
        </div>
      }
    >
      <LogPageContent />
    </Suspense>
  );
}
