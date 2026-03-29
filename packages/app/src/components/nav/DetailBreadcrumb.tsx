"use client";

import Link from "next/link";
interface BreadcrumbLevel {
  label: string;
  href?: string;
}

interface DetailBreadcrumbProps {
  levels: BreadcrumbLevel[];
}

export function DetailBreadcrumb({ levels }: DetailBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 px-6 py-2.5 text-xs bg-curtn-surface border-b border-curtn-dark/50 overflow-x-auto">
      {levels.map((level, i) => {
        const isLast = i === levels.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5 shrink-0">
            {i > 0 && (
              <span className="text-curtn-muted/40 text-[10px]">/</span>
            )}
            {isLast || !level.href ? (
              <span className="text-curtn-cream font-medium truncate max-w-[200px]">
                {level.label}
              </span>
            ) : (
              <Link
                href={level.href}
                className="text-curtn-muted hover:text-curtn-coral transition-colors truncate max-w-[200px]"
              >
                {level.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
