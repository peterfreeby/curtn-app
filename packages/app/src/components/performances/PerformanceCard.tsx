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
  imageUrl?: string | null;
}

export function PerformanceCard({
  id,
  title,
  performanceTypes,
  companyName,
  averageRating,
  reviewCount,
  upcomingCount,
  imageUrl,
}: PerformanceCardProps) {
  return (
    <Link
      href={`/performances/${id}`}
      className="group block dog-ear border border-curtn-dark/50 bg-curtn-surface overflow-hidden transition-colors duration-200 hover:border-curtn-muted/50"
    >
      {/* Poster image */}
      <div className="relative aspect-[3/2] overflow-hidden bg-curtn-dark/20">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon name="ticket" weight="thin" size={32} className="text-curtn-dark" />
          </div>
        )}
        {upcomingCount > 0 && (
          <span className="absolute top-2 right-2 bg-curtn-coral px-2 py-0.5 text-[10px] font-medium text-curtn-deep">
            {upcomingCount} upcoming
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        {performanceTypes.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {performanceTypes.map((type) => (
              <span
                key={type}
                className="bg-curtn-dark/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted"
              >
                {type}
              </span>
            ))}
          </div>
        )}

        <h3 className="text-sm font-semibold text-curtn-cream line-clamp-2 leading-snug">
          {title}
        </h3>

        <p className="mt-1 text-xs text-curtn-muted truncate">{companyName}</p>

        {(averageRating !== null || reviewCount > 0) && (
          <div className="mt-2 flex items-center gap-1 text-xs text-curtn-muted">
            <Icon name="star" weight="fill" size={12} className="text-curtn-coral" />
            <span>
              {averageRating !== null ? averageRating.toFixed(1) : "—"}
              <span className="ml-1 text-curtn-muted/70">
                · {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
              </span>
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
