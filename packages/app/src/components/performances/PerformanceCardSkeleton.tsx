export function PerformanceCardSkeleton() {
  return (
    <div className="rounded-lg border border-curtn-dark/50 bg-curtn-surface p-4 animate-pulse">
      <div className="mb-2 flex gap-1.5">
        <div className="h-4 w-14 rounded-full bg-curtn-dark/60" />
        <div className="h-4 w-18 rounded-full bg-curtn-dark/60" />
      </div>
      <div className="h-5 w-3/4 rounded bg-curtn-dark/60" />
      <div className="mt-2 h-4 w-1/2 rounded bg-curtn-dark/60" />
      <div className="mt-3 h-4 w-1/3 rounded bg-curtn-dark/60" />
    </div>
  );
}
