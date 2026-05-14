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
    <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 h-16 items-center justify-between px-6 bg-curtn-deep border-b border-curtn-dark/20">
      {/* Left: Logo */}
      <Link
        href={isAuthenticated ? "/feed" : "/"}
        className="text-xl font-bold tracking-tight text-curtn-cream hover:text-curtn-coral transition-colors duration-200 font-display uppercase"
      >
        Curtn
      </Link>

      {/* Center: Nav links */}
      <div className="flex items-center gap-8">
        <NavLink href="/browse" className="text-[12px] font-display font-semibold uppercase tracking-[0.5px]">
          Browse
        </NavLink>
        <NavLink href="/upcoming" className="text-[12px] font-display font-semibold uppercase tracking-[0.5px]">
          Map
        </NavLink>
        <NavLink href="/lists" className="text-[12px] font-display font-semibold uppercase tracking-[0.5px]">
          Lists
        </NavLink>
        {isAuthenticated && (
          <>
            <NavLink href="/feed" className="text-[12px] font-display font-semibold uppercase tracking-[0.5px]">
              Feed
            </NavLink>
            <NavLink href="/add" className="text-[12px] font-display font-semibold uppercase tracking-[0.5px]">
              Add
            </NavLink>
            {user?.isAdmin && (
              <NavLink href="/admin" className="text-[12px] font-display font-semibold uppercase tracking-[0.5px] text-curtn-muted/50 hover:text-curtn-muted">
                Admin
              </NavLink>
            )}
          </>
        )}
        <NavLink href="/faq" className="text-[12px] font-display font-semibold uppercase tracking-[0.5px]">
          FAQ
        </NavLink>
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
                className="text-[12px] font-display font-semibold uppercase tracking-[0.5px] text-curtn-muted hover:text-curtn-cream transition-colors duration-200"
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
