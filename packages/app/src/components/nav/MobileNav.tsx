"use client";

import { useAuth } from "@/lib/auth/useAuth";
import { NavLink } from "./NavLink";
import { Icon } from "@/components/icons/Icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNav() {
  const { isAuthenticated, user } = useAuth();
  const pathname = usePathname();

  const profileHref =
    isAuthenticated && user ? `/u/${user.username}` : "/login";

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="md:hidden shrink-0 bg-curtn-deep border-t border-curtn-dark/20 pb-safe">
      <div className="flex items-center justify-around h-16">
        <NavLink
          href="/feed"
          className="flex items-center justify-center w-10 h-10"
          activeClassName="text-curtn-cream"
          inactiveClassName="text-curtn-muted"
          aria-label="Activity"
        >
          <Icon name="lightning" weight={isActive("/feed") ? "fill" : "regular"} />
        </NavLink>

        <NavLink
          href="/browse"
          className="flex items-center justify-center w-10 h-10"
          activeClassName="text-curtn-cream"
          inactiveClassName="text-curtn-muted"
          aria-label="Browse"
        >
          <Icon name="compass" weight={isActive("/browse") ? "fill" : "regular"} />
        </NavLink>

        {/* Center: Log — square coral dog-ear (Von Restorff) */}
        <Link
          href="/log"
          scroll={false}
          className="flex items-center justify-center w-12 h-12 -mt-4 dog-ear dog-ear-dark bg-curtn-coral text-curtn-deep shadow-lg hover:bg-curtn-red active:scale-95 transition-all duration-200"
          aria-label="Log a performance"
        >
          <Icon name="plus" weight="bold" />
        </Link>

        <NavLink
          href="/search"
          className="flex items-center justify-center w-10 h-10"
          activeClassName="text-curtn-cream"
          inactiveClassName="text-curtn-muted"
          aria-label="Search"
        >
          <Icon name="magnifying-glass" weight={isActive("/search") ? "fill" : "regular"} />
        </NavLink>

        <NavLink
          href={profileHref}
          className="flex items-center justify-center w-10 h-10"
          activeClassName="text-curtn-cream"
          inactiveClassName="text-curtn-muted"
          aria-label="Profile"
        >
          <Icon name="user" weight={isActive(profileHref) ? "fill" : "regular"} />
        </NavLink>
      </div>
    </nav>
  );
}
