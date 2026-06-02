"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "urql";
import { SINGLE_PERFORMANCE_QUERY } from "@/lib/graphql/performances";
import { DetailHero } from "@/components/DetailHero";
import { DetailBreadcrumb } from "@/components/nav/DetailBreadcrumb";
import { CreditsList } from "@/components/credits/CreditsList";
import { InlineEditor } from "@/components/admin/InlineEditor";
import { useAuth } from "@/lib/auth/useAuth";

function decodeId(globalId: string): string {
  return atob(globalId).split(":")[1];
}

// Real single-performance detail page. A performance is one specific date —
// it ALWAYS shows that night's lineup via effectiveCast (which resolves
// correctly for both fixed-cast plays and variable-lineup runs). The
// "lineup varies by date" note belongs on the aggregate run page only;
// never here. See [[Per-Performance Cast Attribution]].
export default function PerformanceDetailPage() {
  const params = useParams();
  const id = decodeURIComponent(params.id as string);

  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const [editing, setEditing] = useState(false);

  const [{ data, fetching }] = useQuery({
    query: SINGLE_PERFORMANCE_QUERY,
    variables: { id },
  });

  const performance = data?.singlePerformance;

  if (fetching) {
    return (
      <div className="px-4 py-8 max-w-lg mx-auto animate-pulse space-y-4">
        <div className="h-8 w-3/4 bg-curtn-dark/60" />
        <div className="h-4 w-1/2 bg-curtn-dark/60" />
      </div>
    );
  }

  if (!performance) {
    return (
      <div className="px-4 py-8 max-w-lg mx-auto">
        <p className="text-curtn-muted text-sm">Performance not found.</p>
      </div>
    );
  }

  const run = performance.run;
  const show = run?.show;
  const company = run?.productionCompany;
  const venues = run?.venues || [];
  const isSoldOut =
    performance.soldOut === true || performance.soldOut === "true";

  const runLabel =
    run?.title || company?.name || venues[0]?.name || "Production";
  const perfLabel = performance.date
    ? new Date(performance.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Performance";

  return (
    <div className="relative">
      {show && run && (
        <DetailBreadcrumb
          levels={[
            {
              label: show.title,
              href: `/performances/${encodeURIComponent(show.id)}?view=show`,
            },
            {
              label: runLabel,
              href: `/runs/${encodeURIComponent(run.id)}?view=run`,
            },
            { label: perfLabel },
          ]}
        />
      )}
      <div className="px-2 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto space-y-8">
        {editing ? (
          <InlineEditor
            entityType="performance"
            entityId={decodeId(id)}
            initialValues={{
              date: performance.date
                ? new Date(performance.date).toISOString().slice(0, 10)
                : "",
              time: performance.time || "",
              ticketUrl: performance.ticketUrl || "",
              soldOut: String(isSoldOut),
              imageUrl: performance.metadataOverrides?.imageUrl || "",
            }}
            effectiveCast={performance.effectiveCast ?? []}
            effectiveCrew={performance.effectiveCrew ?? []}
            onSaved={() => {
              setEditing(false);
              window.location.reload();
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <DetailHero
            title={show?.title ?? "Performance"}
            description={performance.effectiveDescription || ""}
            performanceTypes={show?.performanceTypes}
            duration={show?.duration}
            intermissions={run?.intermissions}
            languages={show?.languages ?? []}
            imageUrl={show?.imageUrl}
            posterUrl={performance.effectivePosterUrl || show?.posterUrl}
            companyName={company?.name}
            companySlug={company?.slug}
            venues={venues.map((v: any) => ({
              name: v.name,
              slug: v.slug,
              city: v.city,
            }))}
            startDate={performance.date}
            endDate={null}
            averageRating={run?.averageRating}
            reviewCount={run?.reviewCount}
            performanceDate={performance.date}
            performanceTime={performance.time}
            ticketUrl={performance.ticketUrl}
            soldOut={isSoldOut}
            entityType="Performance"
            onEdit={isAdmin ? () => setEditing(true) : undefined}
          />
        )}

        {/* A performance is one date — always its own lineup, never an
            aggregate or a "varies by date" note. */}
        <CreditsList
          cast={performance.effectiveCast ?? []}
          crew={performance.effectiveCrew ?? []}
        />
      </div>
    </div>
  );
}
