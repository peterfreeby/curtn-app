"use client";

import { useCallback, useRef, useState } from "react";
import { Icon } from "@/components/icons/Icons";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
}

// Drag distance (px) before a press is treated as a half-star drag rather
// than a tap. Keeps thumb jitter from accidentally setting half values.
const DRAG_THRESHOLD = 6;

export function StarRating({
  value,
  onChange,
  size = 24,
  readOnly = false,
}: StarRatingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  // Set true mid-drag; persists through the trailing click so the tap handler
  // knows the drag already committed a value. Reset on the next pointerdown.
  const didDragRef = useRef(false);
  const [preview, setPreview] = useState<number | null>(null);

  const displayValue = preview ?? value;

  // Map an x coordinate across the 5-star strip to a 0.5-granular rating.
  const valueFromX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width; // 0..1
    const raw = Math.max(0, Math.min(5, ratio * 5));
    return Math.max(0.5, Math.round(raw * 2) / 2); // nearest half, min 0.5
  }, [value]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (readOnly || !onChange) return;
      startXRef.current = e.clientX;
      didDragRef.current = false;
      containerRef.current?.setPointerCapture?.(e.pointerId);
    },
    [readOnly, onChange]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (readOnly || !onChange) return;
      if (!containerRef.current?.hasPointerCapture?.(e.pointerId)) return;
      if (!didDragRef.current && Math.abs(e.clientX - startXRef.current) < DRAG_THRESHOLD) return;
      didDragRef.current = true;
      setPreview(valueFromX(e.clientX));
    },
    [readOnly, onChange, valueFromX]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (readOnly || !onChange) return;
      if (didDragRef.current) onChange(valueFromX(e.clientX)); // drag → half-granular
      setPreview(null);
      containerRef.current?.releasePointerCapture?.(e.pointerId);
    },
    [readOnly, onChange, valueFromX]
  );

  // A tap (no drag) always sets a whole star. Toggles off if tapping the
  // current full value.
  const handleStarClick = useCallback(
    (starIndex: number) => {
      if (readOnly || !onChange) return;
      if (didDragRef.current) return; // the drag already committed a value
      const full = starIndex + 1;
      onChange(full === value ? 0 : full);
    },
    [readOnly, onChange, value]
  );

  function starIcon(i: number) {
    const filled = displayValue >= i + 1;
    const halfFilled = !filled && displayValue >= i + 0.5;

    if (filled) return <Icon name="star" weight="fill" size={size} className="text-curtn-coral" />;
    if (halfFilled) return <Icon name="star-half" weight="fill" size={size} className="text-curtn-coral" />;
    return <Icon name="star" weight="regular" size={size} className="text-curtn-dark" />;
  }

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-0.5 touch-none"
      role={readOnly ? "img" : "radiogroup"}
      aria-label={`Rating: ${displayValue} out of 5 stars`}
      onPointerDown={readOnly ? undefined : handlePointerDown}
      onPointerMove={readOnly ? undefined : handlePointerMove}
      onPointerUp={readOnly ? undefined : handlePointerUp}
    >
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
            onClick={() => handleStarClick(i)}
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
