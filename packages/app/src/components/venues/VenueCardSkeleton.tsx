export function VenueCardSkeleton() {
  return (
    <div className="rounded-lg border border-curtn-dark/50 bg-curtn-surface p-4 animate-pulse">
      <div className="h-4 w-16 rounded-full bg-curtn-dark/60" />
      <div className="mt-2 h-5 w-3/4 rounded bg-curtn-dark/60" />
      <div className="mt-2 h-4 w-2/3 rounded bg-curtn-dark/60" />
      <div className="mt-1 h-4 w-1/3 rounded bg-curtn-dark/60" />
    </div>
  );
}
