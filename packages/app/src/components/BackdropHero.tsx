import { Icon } from "@/components/icons/Icons";

interface BackdropHeroProps {
  backdropUrl?: string | null;
  posterUrl?: string | null;
  title: string;
  subtitle?: string;
  meta?: string;
  children?: React.ReactNode;
}

export function BackdropHero({
  backdropUrl,
  posterUrl,
  title,
  subtitle,
  meta,
  children,
}: BackdropHeroProps) {
  return (
    <div className="relative -mx-[var(--spacing-3)] -mt-[var(--spacing-4)]">
      {/* Backdrop image */}
      <div className="relative h-[var(--spacing-40)] sm:h-[var(--spacing-48)] overflow-hidden">
        {backdropUrl ? (
          <img
            src={backdropUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-curtn-surface" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-curtn-deep via-curtn-deep/60 to-curtn-deep/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-curtn-deep/80 to-transparent" />
      </div>

      {/* Content overlay */}
      <div className="relative -mt-[var(--spacing-16)] sm:-mt-[var(--spacing-20)] px-[var(--spacing-3)] flex gap-[var(--spacing-2_5)] items-end">
        {/* Poster */}
        <div className="w-[var(--spacing-16)] sm:w-[var(--spacing-20)] shrink-0">
          <div className="aspect-[2/3] overflow-hidden rounded-[var(--spacing-1)] border-2 border-curtn-dark/50 bg-curtn-surface shadow-2xl">
            {posterUrl ? (
              <img src={posterUrl} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Icon name="ticket" weight="thin" size={40} className="text-curtn-dark" />
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pb-[var(--spacing-0_5)]">
          <h1 className="text-2xl sm:text-3xl font-bold text-curtn-cream leading-tight">{title}</h1>
          {subtitle && (
            <p className="mt-[var(--spacing-0_5)] text-sm text-curtn-muted">{subtitle}</p>
          )}
          {meta && (
            <p className="mt-[var(--spacing-0_5)] text-xs text-curtn-muted/60">{meta}</p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
