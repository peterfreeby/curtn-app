"use client";

import Link from "next/link";
import { Icon } from "@/components/icons/Icons";

interface PerformanceCardProps {
  id: string;
  title: string;
  performanceTypes: string[];
  companyName: string;
  averageRating: number | null;
  reviewCount: number;
  upcomingCount: number;
}

export function PerformanceCard({
  id,
  title,
  performanceTypes,
  companyName,
  averageRating,
  reviewCount,
  upcomingCount,
}: PerformanceCardProps) {
  return (
    <Link
      href={`/performances/${id}`}
      className="block rounded-lg border border-curtn-dark/50 bg-curtn-surface p-4 transition-colors duration-200 hover:border-curtn-muted/50"
    >
      {performanceTypes.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {performanceTypes.map((type) => (
            <span
              key={type}
              className="rounded-full bg-curtn-dark/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted"
            >
              {type}
            </span>
          ))}
        </div>
      )}

      <h3 className="text-base font-semibold text-curtn-cream line-clamp-2 leading-snug">
        {title}
      </h3>

      <p className="mt-1 text-sm text-curtn-muted truncate">{companyName}</p>

      {(averageRating !== null || reviewCount > 0) && (
        <div className="mt-2 flex items-center gap-1 text-sm text-curtn-muted">
          <Icon name="star" weight="fill" size={14} className="text-curtn-coral" />
          <span>
            {averageRating !== null ? averageRating.toFixed(1) : "—"}
            <span className="ml-1 text-curtn-muted/70">
              · {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
            </span>
          </span>
        </div>
      )}

      {upcomingCount > 0 && (
        <p className="mt-2 text-xs text-curtn-coral">
          {upcomingCount} upcoming {upcomingCount === 1 ? "show" : "shows"}
        </p>
      )}
    </Link>
  );
}
