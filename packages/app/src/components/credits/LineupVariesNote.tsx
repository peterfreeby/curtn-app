import { Icon } from "@/components/icons/Icons";
import { CreditsList } from "@/components/credits/CreditsList";

// Shown on a Run (or run-view of a show page) when the run's lineup varies
// per performance — recurring showcases, comedy nights. The run carries no
// shared aggregate cast (the API returns it empty by design), so rendering
// CreditsList would show nothing; this points people at the per-date
// performances instead. If aggregate credits somehow still exist, fall back
// to showing them. See [[Per-Performance Cast Attribution]].
export function LineupVariesNote({
  cast,
  crew,
}: {
  cast?: any[];
  crew?: any[];
}) {
  if ((cast?.length ?? 0) > 0 || (crew?.length ?? 0) > 0) {
    return <CreditsList cast={cast ?? []} crew={crew ?? []} />;
  }
  return (
    <div className="dog-ear dog-ear-dark border border-curtn-dark bg-curtn-surface px-4 py-3">
      <div className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-wide text-curtn-cream">
        <Icon name="users-three" weight="bold" />
        Lineup varies by date
      </div>
      <p className="mt-1 font-sans text-xs text-curtn-muted">
        This run has a different lineup each performance. See an individual date
        below for that night&rsquo;s cast.
      </p>
    </div>
  );
}
