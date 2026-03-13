"use client";

import { useAuth } from "@/lib/auth/useAuth";
import { NavLink } from "./NavLink";
import { Icon } from "@/components/icons/Icons";
import Link from "next/link";

export function MobileNav() {
  const { isAuthenticated, user } = useAuth();

  return (
    <nav className="md:hidden shrink-0 bg-curtn-deep/95 backdrop-blur-sm border-t border-curtn-dark/20 pb-safe">
      <div className="flex items-center justify-around h-16">
        <NavLink
          href="/feed"
          className="flex flex-col items-center gap-1 text-[10px] font-medium"
        >
          <Icon name="house" />
          Home
        </NavLink>

        <NavLink
          href="/performances"
          className="flex flex-col items-center gap-1 text-[10px] font-medium"
        >
          <Icon name="compass" />
          Browse
        </NavLink>

        {/* Center: Log — raised coral circle (Von Restorff) */}
        <Link
          href="/log"
          className="flex items-center justify-center w-12 h-12 -mt-4 rounded-full bg-curtn-coral text-curtn-deep shadow-lg hover:bg-curtn-red active:scale-95 transition-all duration-200"
          aria-label="Log a performance"
        >
          <Icon name="plus" weight="bold" />
        </Link>

        <NavLink
          href="/venues"
          className="flex flex-col items-center gap-1 text-[10px] font-medium"
        >
          <Icon name="map-pin" />
          Venues
        </NavLink>

        <NavLink
          href={isAuthenticated && user ? `/u/${user.username}` : "/login"}
          className="flex flex-col items-center gap-1 text-[10px] font-medium"
        >
          <Icon name="user" />
          Profile
        </NavLink>
      </div>
    </nav>
  );
}
