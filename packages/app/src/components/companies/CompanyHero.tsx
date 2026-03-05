"use client";

import { useState } from "react";

interface CompanyHeroProps {
  name: string;
  description: string | null;
  logoUrl: string | null;
}

export function CompanyHero({ name, description, logoUrl }: CompanyHeroProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex gap-6 items-start">
      {logoUrl && (
        <img
          src={logoUrl}
          alt={name}
          className="h-20 w-20 shrink-0 rounded-lg object-contain border border-curtn-dark/50 bg-curtn-dark/30 p-2"
        />
      )}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-curtn-cream leading-tight">{name}</h1>

        {description && (
          <div className="mt-3">
            <p
              className={`text-sm text-curtn-cream/80 leading-relaxed ${
                !expanded ? "line-clamp-3" : ""
              }`}
            >
              {description}
            </p>
            {description.length > 150 && (
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
