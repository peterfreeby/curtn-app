"use client";

import Link from "next/link";

interface CreditRowProps {
  index: number;
  personName: string;
  personSlug: string;
  role: string;
  headshotUrl?: string | null;
}

export function CreditRow({ index, personName, personSlug, role, headshotUrl }: CreditRowProps) {
  return (
    <Link href={`/people/${personSlug}`} className="list-item">
      <span className="li-num">{String(index).padStart(2, "0")}</span>
      <span className="li-thumb">
        {headshotUrl ? (
          <img src={headshotUrl} alt="" />
        ) : (
          <span className="block h-full w-full bg-curtn-dark/40" />
        )}
      </span>
      <span className="li-content">
        <span className="li-title">{personName}</span>
        <span className="li-sub ml-2">{role}</span>
      </span>
    </Link>
  );
}
