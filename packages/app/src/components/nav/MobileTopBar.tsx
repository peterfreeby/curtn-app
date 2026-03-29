"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/useAuth";
import { Avatar } from "@/components/Avatar";

export function MobileTopBar() {
  const { user, isAuthenticated, isLoading } = useAuth();

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-40">
      {/* Background extends behind status bar */}
      <div className="bg-gradient-to-b from-curtn-deep via-curtn-deep/90 to-transparent">
        <div className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] pb-3">
          <Link
            href={isAuthenticated ? "/feed" : "/"}
            className="text-lg font-bold tracking-tight text-curtn-cream font-display uppercase"
          >
            Curtn
          </Link>
          {!isLoading && isAuthenticated && user && (
            <Link href={`/u/${user.username}`}>
              <Avatar
                src={user.avatarUrl || undefined}
                name={user.fullName}
                size="sm"
              />
            </Link>
          )}
          {!isLoading && !isAuthenticated && (
            <Link
              href="/login"
              className="text-xs text-curtn-muted hover:text-curtn-cream transition-colors font-display uppercase"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
