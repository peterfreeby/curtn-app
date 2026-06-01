"use client";

import { useState } from "react";

interface ShowThumbProps {
  imageUrl?: string | null;
  title: string;
  /** Tailwind width class for the thumbnail (default w-8). */
  className?: string;
}

/**
 * Small show poster thumbnail used in feed/profile cards.
 * Falls back to the show title's initial on the surface background when
 * there's no poster URL or the image fails to load — never a broken-image "?".
 */
export function ShowThumb({ imageUrl, title, className = "w-8" }: ShowThumbProps) {
  const [failed, setFailed] = useState(false);
  const hasImage = !!imageUrl && !failed;
  const initial = title.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={`${className} shrink-0`}>
      <div className="aspect-[2/3] overflow-hidden rounded-sm bg-curtn-surface">
        {hasImage ? (
          <img
            src={imageUrl as string}
            alt={title}
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display font-bold uppercase text-curtn-cream/70 leading-none">
            {initial}
          </div>
        )}
      </div>
    </div>
  );
}
