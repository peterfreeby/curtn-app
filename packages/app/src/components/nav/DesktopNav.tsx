"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/useAuth";
import { NavLink } from "./NavLink";
import { SearchTrigger } from "./SearchTrigger";
import { LogButton } from "./LogButton";
import { ProfileDropdown } from "./ProfileDropdown";

export function DesktopNav() {
  const { user, isAuthenticated, isLoading } = useAuth();

  return (
    <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 h-16 items-center justify-between px-6 bg-curtn-deep/95 backdrop-blur-sm border-b border-curtn-dark/20">
      {/* Left: Logo */}
      <Link
        href={isAuthenticated ? "/feed" : "/"}
        className="text-xl font-bold tracking-tight text-curtn-cream hover:text-curtn-coral transition-colors duration-200"
      >
        Curtn
      </Link>

      {/* Center: Nav links */}
      <div className="flex items-center gap-8">
        <NavLink href="/performances" className="text-sm font-medium">
          Browse
        </NavLink>
        <NavLink href="/venues" className="text-sm font-medium">
          Venues
        </NavLink>
        {isAuthenticated && (
          <>
            <NavLink href="/feed" className="text-sm font-medium">
              Feed
            </NavLink>
            <NavLink href="/add" className="text-sm font-medium">
              Add
            </NavLink>
            {user?.isAdmin && (
              <NavLink href="/admin" className="text-sm font-medium text-curtn-muted/50 hover:text-curtn-muted">
                Admin
              </NavLink>
            )}
          </>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        <SearchTrigger />
        {!isLoading && (
          <>
            {isAuthenticated ? (
              <>
                <LogButton />
                <ProfileDropdown />
              </>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium text-curtn-muted hover:text-curtn-cream transition-colors duration-200"
              >
                Sign In
              </Link>
            )}
          </>
        )}
      </div>
    </nav>
  );
}
