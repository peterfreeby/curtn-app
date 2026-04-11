"use client";

import { useAuth } from "@/lib/auth/useAuth";
import { AddPerformanceForm } from "@/components/add/AddPerformanceForm";
import { Card } from "@/components/Card";
import Link from "next/link";

export default function AddPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-lg mx-auto animate-pulse space-y-4">
        <div className="h-4 w-32 rounded bg-curtn-dark/60" />
        <div className="h-48 rounded-xl bg-curtn-dark/60" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-lg mx-auto">
        <Card className="text-center space-y-4">
          <p className="text-curtn-cream font-medium">
            Sign in to add a performance
          </p>
          <p className="text-sm text-curtn-muted">
            You need an account to add shows and performances to the archive.
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

  return (
    <div className="px-4 sm:px-6 py-8">
      <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-8 max-w-lg mx-auto">
        Add a Performance
      </h2>
      <AddPerformanceForm />
    </div>
  );
}
