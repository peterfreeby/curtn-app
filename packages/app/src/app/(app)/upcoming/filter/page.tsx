"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons/Icons";
import {
  DATE_FILTERS,
  SECTION_LABELS,
  SECTION_ORDER,
  type DateFilter,
} from "@/lib/mapFilters";

export default function MapFilterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("current") ?? "all";

  const select = (key: DateFilter) => {
    if (key === "all") router.replace("/upcoming");
    else router.replace(`/upcoming?filter=${key}`);
  };

  return (
    <div className="bg-curtn-deep min-h-dvh">
      <div className="px-[11px] pb-3 -mt-1">
        <h1 className="text-lg font-bold text-curtn-cream">Filter by date</h1>
      </div>

      <div className="pb-[calc(env(safe-area-inset-bottom)+6rem)]">
        {SECTION_ORDER.map((section) => (
          <div key={section} className="mt-4">
            <p className="px-[11px] pb-1 text-[10px] uppercase tracking-widest text-curtn-muted/70">
              {SECTION_LABELS[section]}
            </p>
            {DATE_FILTERS.filter((f) => f.section === section).map((f) => {
              const isActive = current === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => select(f.key)}
                  className={`w-full text-left px-[11px] py-4 text-sm flex items-center justify-between border-b border-curtn-dark/30 cursor-pointer transition-colors ${
                    isActive ? "text-curtn-coral" : "text-curtn-cream hover:bg-curtn-surface/40"
                  }`}
                >
                  <span>{f.label}</span>
                  {isActive && <Icon name="check" weight="bold" size={16} />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
