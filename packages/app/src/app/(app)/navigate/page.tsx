"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useNowViewing } from "@/lib/NowViewingContext";

interface BreadcrumbLevel {
  label: string;
  sublabel?: string | null;
  href: string;
}

interface NavData {
  breadcrumbs: BreadcrumbLevel[];
  currentHref: string;
  currentEntityType: string;
  title: string;
}

export default function NavigatePage() {
  const router = useRouter();
  const { setNowViewing } = useNowViewing();
  const [navData, setNavData] = useState<NavData | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("curtn_nav_breadcrumbs");
      if (raw) {
        const parsed = JSON.parse(raw);
        setNavData(parsed);
        // Keep the detail nav bar visible by restoring nowViewing
        setNowViewing({
          title: parsed.title,
          entityType: 'Related pages',
          href: parsed.currentHref,
          breadcrumbs: parsed.breadcrumbs,
        });
      }
    } catch {}
    return () => setNowViewing(null);
  }, [setNowViewing]);

  if (!navData || navData.breadcrumbs.length === 0) {
    return (
      <div className="px-4 py-8 max-w-lg mx-auto">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer"
        >
          &larr; Go back
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 max-w-lg mx-auto">
      <p className="text-xs uppercase tracking-widest text-curtn-muted mb-6">
        Related pages
      </p>

      <div className="space-y-0">
        {navData.breadcrumbs.map((crumb, i) => {
          const isCurrent = crumb.sublabel === navData.currentEntityType;

          return (
            <div key={`${i}-${crumb.sublabel}`}>
              {/* Connector line between items */}
              {i > 0 && (
                <div className="flex items-center py-1.5 pl-5">
                  <div className="w-px h-4 bg-curtn-dark/60" />
                </div>
              )}

              {isCurrent ? (
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex items-center gap-3 px-4 py-3 border border-curtn-coral/30 bg-curtn-coral/5 w-full text-left cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-curtn-coral">
                      {crumb.label}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-curtn-coral/60 mt-0.5">
                      {crumb.sublabel}
                    </p>
                  </div>
                </button>
              ) : (
                <Link
                  href={crumb.href}
                  className="flex items-center gap-3 px-4 py-3 border border-curtn-dark/50 hover:border-curtn-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-curtn-cream">
                      {crumb.label}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-curtn-muted mt-0.5">
                      {crumb.sublabel}
                    </p>
                  </div>
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
