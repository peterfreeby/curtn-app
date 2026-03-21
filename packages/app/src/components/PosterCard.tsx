"use client";

import { Icon, type IconName } from "@/components/icons/Icons";
import { useDuotone } from "@/hooks/useDuotone";

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
  { icon: "clock-countdown", label: "Watchlist" },
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
  const Wrapper = href ? "a" : "div";
  const wrapperProps = href ? { href } : {};
  const resolvedActions = actions ?? defaultActions;
  const { canvasRef } = useDuotone(imageUrl);

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <Wrapper
        {...wrapperProps}
        className="group relative block aspect-[2/3] overflow-hidden dog-ear bg-curtn-surface border border-curtn-dark/30"
      >
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {/* Duotone canvas overlay — fades out on hover to reveal full color */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full opacity-100 group-hover:opacity-0 transition-opacity duration-400 pointer-events-none"
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center p-[var(--spacing-2)]">
            <Icon name="ticket" weight="thin" size={40} className="text-curtn-dark" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-curtn-deep/90 via-curtn-deep/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        {/* Action icons */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center gap-[var(--spacing-1)] p-[var(--spacing-1)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {resolvedActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                action.onClick?.();
              }}
              className="flex h-[var(--spacing-4)] w-[var(--spacing-4)] items-center justify-center bg-curtn-deep/60 text-curtn-cream/70 transition-colors hover:text-curtn-cream cursor-pointer"
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
      </Wrapper>

      {/* Title below poster */}
      {(title || subtitle) && (
        <div className="mt-[var(--spacing-0_5)] px-[var(--spacing-0_5)]">
          <p className="text-[13px] font-display font-bold uppercase text-curtn-cream truncate">{title}</p>
          {subtitle && (
            <p className="text-[10px] uppercase tracking-[0.5px] font-mono text-curtn-muted truncate">{subtitle}</p>
          )}
        </div>
      )}
    </div>
  );
}
