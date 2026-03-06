"use client";

import { useAuth } from "@/lib/auth/useAuth";
import { Card } from "@/components/Card";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="px-6 py-8 max-w-4xl mx-auto">
        <div className="h-8 w-48 rounded bg-curtn-dark/60 animate-pulse" />
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="px-6 py-8 max-w-4xl mx-auto">
        <Card className="text-center py-16 space-y-2">
          <p className="text-curtn-cream font-medium">Admin access required</p>
          <p className="text-xs text-curtn-muted/60">
            You don&apos;t have permission to view this page.
          </p>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
