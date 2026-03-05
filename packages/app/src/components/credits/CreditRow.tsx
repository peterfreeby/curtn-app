"use client";

import Link from "next/link";

interface CreditRowProps {
  personName: string;
  personSlug: string;
  role: string;
}

export function CreditRow({ personName, personSlug, role }: CreditRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <Link
        href={`/people/${personSlug}`}
        className="text-curtn-cream hover:text-curtn-coral transition-colors truncate"
      >
        {personName}
      </Link>
      <span className="ml-3 shrink-0 text-curtn-muted/70 text-xs">{role}</span>
    </div>
  );
}
