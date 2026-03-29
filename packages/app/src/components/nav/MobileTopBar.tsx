"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/useAuth";
import { Avatar } from "@/components/Avatar";

export function MobileTopBar() {
  const { user, isAuthenticated, isLoading } = useAuth();

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-40">
      <div className="pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 py-2">
          <Link
            href={isAuthenticated ? "/feed" : "/"}
            className="text-lg font-bold tracking-tight text-curtn-cream font-display uppercase drop-shadow-md"
          >
            Curtn
          </Link>
          {!isLoading && isAuthenticated && user && (
            <Link
              href={`/u/${user.username}`}
              className="w-8 h-8 rounded-full shadow-md shadow-black/30 block"
            >
              <Avatar
                src={user.avatarUrl || undefined}
                name={user.fullName}
                size="sm"
                className="!w-8 !h-8"
              />
            </Link>
          )}
          {!isLoading && !isAuthenticated && (
            <Link
              href="/login"
              className="text-xs text-curtn-muted hover:text-curtn-cream transition-colors font-display uppercase drop-shadow-md"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
