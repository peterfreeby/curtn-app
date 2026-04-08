export function ListCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-end -space-x-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-[80px] aspect-[2/3] bg-curtn-dark/40"
            style={{ zIndex: 5 - i }}
          />
        ))}
      </div>

      <div className="pt-[var(--spacing-1_5)]">
        <div className="h-3 w-14 bg-curtn-dark/60" />
        <div className="mt-2 h-4 w-3/4 bg-curtn-dark/60" />
        <div className="mt-3 flex items-center justify-between">
          <div className="h-3 w-16 bg-curtn-dark/60" />
          <div className="h-3 w-20 bg-curtn-dark/60" />
        </div>
      </div>
    </div>
  );
}
