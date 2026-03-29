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
  const parent = levels.length > 1 ? levels[levels.length - 2] : null;

  return (
    <nav className="absolute top-0 left-0 right-0 z-10 px-6 pt-4">
      {/* Mobile: labelled back button */}
      {parent?.href && (
        <Link
          href={parent.href}
          className="md:hidden inline-flex items-center gap-1 text-xs text-curtn-cream/80 hover:text-curtn-coral transition-colors bg-curtn-deep/60 backdrop-blur-sm px-2.5 py-1.5 rounded-sm"
        >
          <span className="text-[10px]">&larr;</span>
          {parent.label}
        </Link>
      )}

      {/* Desktop: full breadcrumb */}
      <div className="hidden md:flex items-center gap-1.5 text-xs">
        {levels.map((level, i) => {
          const isLast = i === levels.length - 1;
          return (
            <span key={i} className="flex items-center gap-1.5 shrink-0">
              {i > 0 && (
                <span className="text-curtn-cream/30 text-[10px]">/</span>
              )}
              {isLast || !level.href ? (
                <span className="text-curtn-cream font-medium truncate max-w-[200px] drop-shadow-sm">
                  {level.label}
                </span>
              ) : (
                <Link
                  href={level.href}
                  className="text-curtn-cream/70 hover:text-curtn-coral transition-colors truncate max-w-[200px] drop-shadow-sm"
                >
                  {level.label}
                </Link>
              )}
            </span>
          );
        })}
      </div>
    </nav>
  );
}
