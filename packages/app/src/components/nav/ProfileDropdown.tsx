"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/useAuth";
import { Icon } from "@/components/icons/Icons";

export function ProfileDropdown() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const initial = user.fullName.charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-curtn-cream hover:text-curtn-coral transition-colors duration-200"
      >
        <span className="w-8 h-8 rounded-full bg-curtn-surface border border-curtn-dark/50 flex items-center justify-center text-sm font-semibold">
          {initial}
        </span>
        <Icon name="caret-down" size={16} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-curtn-surface border border-curtn-dark/30 dog-ear py-2 shadow-lg z-50">
          <Link
            href={`/u/${user.username}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-curtn-cream hover:bg-curtn-deep/50 transition-colors"
          >
            <Icon name="user" size={16} className="text-curtn-muted" />
            Profile
          </Link>
          <Link
            href="/lists"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-curtn-cream hover:bg-curtn-deep/50 transition-colors"
          >
            <Icon name="list-bullets" size={16} className="text-curtn-muted" />
            My Lists
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-curtn-cream hover:bg-curtn-deep/50 transition-colors w-full text-left"
          >
            <Icon name="sign-out" size={16} className="text-curtn-muted" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
