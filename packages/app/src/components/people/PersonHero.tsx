"use client";

import { useState } from "react";

interface PersonHeroProps {
  name: string;
  bio: string | null;
  headshotUrl: string | null;
}

export function PersonHero({ name, bio, headshotUrl }: PersonHeroProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex gap-6 items-start">
      {headshotUrl && (
        <img
          src={headshotUrl}
          alt={name}
          className="h-24 w-24 shrink-0 rounded-full object-cover border border-curtn-dark/50"
        />
      )}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-curtn-cream leading-tight">{name}</h1>

        {bio && (
          <div className="mt-3">
            <p
              className={`text-sm text-curtn-cream/80 leading-relaxed ${
                !expanded ? "line-clamp-3" : ""
              }`}
            >
              {bio}
            </p>
            {bio.length > 150 && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="mt-1 text-xs text-curtn-coral hover:underline"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
