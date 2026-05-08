"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps
  extends Omit<React.ComponentProps<typeof Link>, "href" | "className"> {
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
  activeClassName = "text-curtn-cream border-b-2 border-curtn-coral",
  inactiveClassName = "text-curtn-muted hover:text-curtn-cream border-b-2 border-transparent",
  ...rest
}: NavLinkProps) {
  const pathname = usePathname() ?? "";
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`${className} ${isActive ? activeClassName : inactiveClassName} transition-colors duration-200`}
      {...rest}
    >
      {children}
    </Link>
  );
}
