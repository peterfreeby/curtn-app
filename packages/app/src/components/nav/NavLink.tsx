"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
}

export function NavLink({
  href,
  children,
  className = "",
  activeClassName = "text-curtn-cream",
  inactiveClassName = "text-curtn-muted hover:text-curtn-cream",
}: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`${className} ${isActive ? activeClassName : inactiveClassName} transition-colors duration-200`}
    >
      {children}
    </Link>
  );
}
