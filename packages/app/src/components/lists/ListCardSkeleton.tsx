export function ListCardSkeleton() {
  return (
    <div className="dog-ear border border-curtn-dark/50 bg-curtn-surface p-[var(--spacing-2)] animate-pulse">
      <div className="h-3 w-14 bg-curtn-dark/60" />
      <div className="mt-2 h-4 w-3/4 bg-curtn-dark/60" />
      <div className="mt-2 h-3 w-full bg-curtn-dark/60" />
      <div className="mt-3 flex items-center justify-between">
        <div className="h-3 w-16 bg-curtn-dark/60" />
        <div className="h-3 w-20 bg-curtn-dark/60" />
      </div>
    </div>
  );
}
