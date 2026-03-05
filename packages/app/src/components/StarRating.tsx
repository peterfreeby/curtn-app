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

  return (
    <div ref={containerRef} className="flex items-center gap-0.5" role={readOnly ? "img" : "radiogroup"} aria-label={`Rating: ${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = value >= i + 1;
        const halfFilled = !filled && value >= i + 0.5;

        if (readOnly) {
          return (
            <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
              {/* Empty star base */}
              <Icon name="star" weight="regular" size={size} className="text-curtn-dark" />
              {/* Filled overlay */}
              {(filled || halfFilled) && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: filled ? "100%" : "50%" }}
                >
                  <Icon name="star" weight="fill" size={size} className="text-curtn-coral" />
                </span>
              )}
            </span>
          );
        }

        return (
          <button
            key={i}
            type="button"
            onClick={(e) => handleClick(i, e)}
            className="relative cursor-pointer p-0 border-0 bg-transparent"
            style={{ width: Math.max(size, 48), height: Math.max(size, 48), display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-label={`${i + 1} star${i === 0 ? "" : "s"}`}
          >
            {/* Empty star base */}
            <Icon name="star" weight="regular" size={size} className="text-curtn-dark" />
            {/* Filled overlay */}
            {(filled || halfFilled) && (
              <span
                className="absolute inset-0 overflow-hidden flex items-center justify-center"
                style={{ width: filled ? "100%" : "50%" }}
              >
                <Icon name="star" weight="fill" size={size} className="text-curtn-coral" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
