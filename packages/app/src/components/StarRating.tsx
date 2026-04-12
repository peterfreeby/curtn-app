"use client";

import { useCallback, useRef } from "react";
import { Icon } from "@/components/icons/Icons";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
}

export function StarRating({
  value,
  onChange,
  size = 24,
  readOnly = false,
}: StarRatingProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (starIndex: number, e: React.MouseEvent<HTMLButtonElement>) => {
      if (readOnly || !onChange) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const isLeftHalf = clickX < rect.width / 2;

      const newValue = isLeftHalf ? starIndex + 0.5 : starIndex + 1;
      // Toggle off if clicking same value
      onChange(newValue === value ? 0 : newValue);
    },
    [readOnly, onChange, value]
  );

  function starIcon(i: number) {
    const filled = value >= i + 1;
    const halfFilled = !filled && value >= i + 0.5;

    if (filled) return <Icon name="star" weight="fill" size={size} className="text-curtn-coral" />;
    if (halfFilled) return <Icon name="star-half" weight="fill" size={size} className="text-curtn-coral" />;
    return <Icon name="star" weight="regular" size={size} className="text-curtn-dark" />;
  }

  return (
    <div ref={containerRef} className="flex items-center gap-0.5" role={readOnly ? "img" : "radiogroup"} aria-label={`Rating: ${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => {
        if (readOnly) {
          return (
            <span key={i} className="inline-block" style={{ width: size, height: size }}>
              {starIcon(i)}
            </span>
          );
        }

        return (
          <button
            key={i}
            type="button"
            onClick={(e) => handleClick(i, e)}
            className="cursor-pointer p-0 border-0 bg-transparent flex items-center justify-center"
            style={{ width: Math.max(size, 44), height: Math.max(size, 44) }}
            aria-label={`${i + 1} star${i === 0 ? "" : "s"}`}
          >
            {starIcon(i)}
          </button>
        );
      })}
    </div>
  );
}
