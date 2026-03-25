"use client";

import { useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogForm } from "@/components/log/LogForm";
import { useAuth } from "@/lib/auth/useAuth";
import Link from "next/link";
import { Icon } from "@/components/icons/Icons";

function LogModalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = searchParams.get("run");
  const { isAuthenticated, isLoading } = useAuth();
  
  const onDismiss = useCallback(() => {
    router.back();
  }, [router]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    },
    [onDismiss]
  );

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
        onClick={onDismiss}
      />
      <div className="relative w-full md:w-auto max-w-lg max-h-[90vh] overflow-y-auto bg-curtn-surface border border-curtn-dark/30 rounded-t-xl md:rounded-xl shadow-2xl p-6 md:p-8 animate-in fade-in slide-in-from-bottom-5 md:zoom-in-95 duration-200">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer"
        >
          <Icon name="plus" className="rotate-45" size={24} />
        </button>
        
        {isLoading ? (
          <div className="animate-pulse space-y-4 w-full md:min-w-[400px]">
            <div className="h-4 w-32 rounded bg-curtn-dark/60" />
            <div className="h-48 rounded-xl bg-curtn-dark/60" />
          </div>
        ) : !isAuthenticated ? (
          <div className="text-center space-y-4 py-8 w-full md:min-w-[400px]">
            <p className="text-curtn-cream font-medium">Sign in to log a show</p>
            <p className="text-sm text-curtn-muted">
              You need an account to log performances and leave reviews.
            </p>
            <Link
              href="/login"
              onClick={onDismiss}
              className="inline-block rounded-lg bg-curtn-coral px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-curtn-red"
            >
              Sign In
            </Link>
          </div>
        ) : (
          <div className="w-full md:min-w-[400px]">
            <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-6">
              Log a Performance
            </h2>
            <LogForm runId={runId} />
          </div>
        )}
      </div>
    </div>
  );
}

export function LogModal() {
  return (
    <Suspense>
      <LogModalContent />
    </Suspense>
  );
}
