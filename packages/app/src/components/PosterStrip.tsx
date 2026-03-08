"use client";

interface PosterStripProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function PosterStrip({ title, children, className = "" }: PosterStripProps) {
  return (
    <div className={className}>
      {title && (
        <h3 className="text-xs uppercase tracking-widest text-curtn-muted mb-[var(--spacing-1_5)]">{title}</h3>
      )}
      <div className="flex gap-[var(--spacing-1_5)] overflow-x-auto pb-[var(--spacing-1)] scrollbar-hide -mx-[var(--spacing-3)] px-[var(--spacing-3)]">
        {children}
      </div>
    </div>
  );
}
