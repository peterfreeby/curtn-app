"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/useAuth";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/icons/Icons";

export function MobileTopBar() {
  const { user, isAuthenticated, isLoading } = useAuth();

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-40">
      <div className="pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 py-2">
          <Link
            href={isAuthenticated ? "/feed" : "/"}
            className="text-lg font-bold tracking-tight text-curtn-cream font-display uppercase drop-shadow-[0_4px_20px_rgba(0,0,0,1)]"
          >
            Curtn
          </Link>
          {!isLoading && (
            <Link
              href={isAuthenticated && user ? `/u/${user.username}` : "/login"}
              className="w-8 h-8 rounded-full shadow-[0_4px_20px_rgba(0,0,0,1)] block"
            >
              {isAuthenticated && user?.avatarUrl ? (
                <Avatar
                  src={user.avatarUrl}
                  name={user.fullName}
                  size="sm"
                  className="!w-8 !h-8"
                />
              ) : (
                <div className="w-8 h-8 rounded-full nav-bar flex items-center justify-center">
                  <Icon name="user" size={16} className="text-curtn-muted" />
                </div>
              )}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
