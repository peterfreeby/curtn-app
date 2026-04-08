"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { Icon, type IconName } from "@/components/icons/Icons";
import { useDuotone } from "@/hooks/useDuotone";

const FONT_WEIGHTS = [200, 300, 400, 700, 900];

function seededWeight(word: string, index: number): number {
  let hash = index * 31;
  for (let i = 0; i < word.length; i++) hash = (hash * 37 + word.charCodeAt(i)) | 0;
  return FONT_WEIGHTS[Math.abs(hash) % FONT_WEIGHTS.length];
}

function groupWords(words: string[], maxLines: number): string[] {
  if (words.length <= maxLines) return words;
  // Greedily pack words onto lines — keep adding words while
  // the line's total character count stays under a threshold
  const maxCharsPerLine = 10;
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const combined = current ? current + " " + word : word;
    if (current && combined.length > maxCharsPerLine) {
      lines.push(current);
      current = word;
    } else {
      current = combined;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function TextPoster({ title }: { title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const words = title.split(/\s+/).filter(Boolean);
  // Target ~6 lines max to keep things readable
  const lines = groupWords(words, 6);

  const fitLines = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const padding = 8;
    const availableWidth = container.clientWidth - padding * 2;
    const availableHeight = container.clientHeight - padding * 2;
    if (availableWidth <= 0 || availableHeight <= 0) return;

    const spans = container.querySelectorAll<HTMLSpanElement>("[data-fit-line]");

    // Fit each line to the container width
    spans.forEach((span) => {
      span.style.fontSize = "100px";
      const natural = span.scrollWidth;
      if (natural > 0) {
        span.style.fontSize = `${(availableWidth / natural) * 100}px`;
      }
    });

    // If total height overflows, scale everything down proportionally
    const totalHeight = Array.from(spans).reduce((sum, span) => sum + span.offsetHeight, 0);
    if (totalHeight > availableHeight) {
      const scale = availableHeight / totalHeight;
      spans.forEach((span) => {
        const current = parseFloat(span.style.fontSize);
        span.style.fontSize = `${current * scale}px`;
      });
    }
  }, [lines.length]);

  useEffect(() => {
    fitLines();
    const obs = new ResizeObserver(fitLines);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [fitLines, title]);

  let charIndex = 0;

  return (
    <div ref={containerRef} className="h-full w-full bg-curtn-surface overflow-hidden p-[var(--spacing-1)] flex flex-col justify-center items-center">
      {lines.map((line, i) => {
        const chars = line.split("").map((ch) => {
          if (ch === " ") return { ch, weight: 400 };
          const weight = seededWeight(ch, charIndex);
          charIndex++;
          return { ch, weight };
        });
        return (
          <span key={i} data-fit-line className="block font-display uppercase text-curtn-cream leading-[0.95] whitespace-nowrap">
            {chars.map((c, j) => (
              <span key={j} style={{ fontWeight: c.weight }}>{c.ch}</span>
            ))}
          </span>
        );
      })}
    </div>
  );
}

export interface PosterAction {
  icon: IconName;
  activeIcon?: IconName;
  active?: boolean;
  onClick?: () => void;
  label: string;
}

interface PosterCardProps {
  imageUrl?: string | null;
  title: string;
  subtitle?: string;
  href?: string;
  actions?: PosterAction[];
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-[98px]",   /* 14 × 7 */
  md: "w-[147px]",  /* 21 × 7 */
  lg: "w-[196px]",  /* 28 × 7 */
};

const defaultActions: PosterAction[] = [
  { icon: "eye", label: "Seen" },
  { icon: "list-plus", label: "Watchlist" },
  { icon: "ticket", label: "Tickets" },
];

export function PosterCard({
  imageUrl,
  title,
  subtitle,
  href,
  actions,
  size = "md",
  className = "",
}: PosterCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasImage = !!imageUrl && !imgFailed;
  const Wrapper = href ? "a" : "div";
  const wrapperProps = href ? { href } : {};
  const resolvedActions = actions ?? defaultActions;
  const { canvasRef } = useDuotone(hasImage ? imageUrl : null);

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <Wrapper
        {...wrapperProps}
        className="group relative block aspect-[1/1.58] overflow-hidden bg-curtn-surface border border-curtn-dark/30"
      >
        {hasImage ? (
          <>
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover"
              onError={() => setImgFailed(true)}
            />
            {/* Duotone canvas overlay — fades in on hover */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
            />
          </>
        ) : (
          <TextPoster title={title} />
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-curtn-deep/90 via-curtn-deep/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        {/* Title + actions overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-[var(--spacing-1)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {(title || subtitle) && (
            <div className="mb-[var(--spacing-0_5)]">
              <p className="text-[13px] font-display font-bold uppercase text-curtn-cream truncate">{title}</p>
              {subtitle && (
                <p className="text-[10px] uppercase tracking-[0.5px] font-mono text-curtn-muted truncate">{subtitle}</p>
              )}
            </div>
          )}
          <div className="flex items-center gap-[var(--spacing-1)]">
            {resolvedActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  action.onClick?.();
                }}
                className="flex h-[var(--spacing-4)] w-[var(--spacing-4)] items-center justify-center text-curtn-cream/70 transition-colors hover:text-curtn-cream cursor-pointer"
                aria-label={action.label}
              >
                <Icon
                  name={action.active && action.activeIcon ? action.activeIcon : action.icon}
                  weight={action.active ? "fill" : "regular"}
                  size={14}
                  className={action.active ? "text-curtn-coral" : ""}
                />
              </button>
            ))}
          </div>
        </div>
      </Wrapper>
    </div>
  );
}
