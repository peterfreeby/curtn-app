export function PerformanceCardSkeleton() {
  return (
    <div className="dog-ear border border-curtn-dark/50 bg-curtn-surface p-4 animate-pulse">
      <div className="mb-2 flex gap-1.5">
        <div className="h-4 w-14 bg-curtn-dark/60" />
        <div className="h-4 w-18 bg-curtn-dark/60" />
      </div>
      <div className="h-5 w-3/4 bg-curtn-dark/60" />
      <div className="mt-2 h-4 w-1/2 bg-curtn-dark/60" />
      <div className="mt-3 h-4 w-1/3 bg-curtn-dark/60" />
    </div>
  );
}
