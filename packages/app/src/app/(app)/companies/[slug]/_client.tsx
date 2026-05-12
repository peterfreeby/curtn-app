"use client";

import { useParams } from "next/navigation";
import { useQuery } from "urql";
import Link from "next/link";
import { COMPANY_BY_SLUG_QUERY } from "@/lib/graphql/companies";
import { CompanyHero } from "@/components/companies/CompanyHero";
import { CompanyRuns } from "@/components/companies/CompanyRuns";
import { Icon } from "@/components/icons/Icons";
import { EntityDataSourcesPanel } from "@/components/admin/EntityDataSourcesPanel";
import { ClaimCTA } from "@/components/claim/ClaimCTA";
import { EditHistory } from "@/components/auditLog/EditHistory";
import { useAuth } from "@/lib/auth/useAuth";

function decodeId(globalId: string): string {
  return atob(globalId).split(":")[1];
}

export default function CompanyDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;

  const [{ data, fetching }] = useQuery({
    query: COMPANY_BY_SLUG_QUERY,
    variables: { slug },
  });

  const company = data?.productionCompanyBySlug;

  if (fetching) {
    return (
      <div className="px-2 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto animate-pulse space-y-4">
        <div className="flex gap-6">
          <div className="h-20 w-20 rounded-lg bg-curtn-dark/60 shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-8 w-2/3 rounded bg-curtn-dark/60" />
            <div className="h-4 w-full rounded bg-curtn-dark/60" />
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <div className="h-4 w-24 rounded bg-curtn-dark/60" />
          <div className="h-24 rounded-lg bg-curtn-dark/60" />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="px-2 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto">
        <p className="text-curtn-muted text-sm">Company not found.</p>
      </div>
    );
  }

  const runs = company.runs?.edges?.map((e: any) => e.node) ?? [];
  const venues = company.venues ?? [];
  const people = company.people ?? [];

  return (
    <div className="px-2 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto space-y-8">
      <CompanyHero
        name={company.name}
        description={company.description}
        logoUrl={company.logoUrl}
      />

      <ClaimCTA
        kind="productionCompany"
        slug={company.slug}
        name={company.name}
        claimState={company.claimState}
      />

      {isAdmin && (
        <EntityDataSourcesPanel entityType="company" entityId={company.id} />
      )}

      <CompanyRuns
        runs={runs}
        companyName={company.name}
        companySlug={company.slug}
      />

      {venues.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-curtn-muted">
            Venues ({venues.length})
          </h2>
          <div className="space-y-1">
            {venues.map((v: any) => (
              <Link
                key={v.id}
                href={`/venues/${v.slug}`}
                className="flex items-center gap-2 py-1.5 text-sm text-curtn-cream hover:text-curtn-coral transition-colors"
              >
                <Icon name="map-pin" size={14} className="text-curtn-muted" />
                {v.name}
                <span className="text-curtn-muted/50 text-xs">{v.city}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {people.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-curtn-muted">
            People ({people.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {people.map((p: any) => (
              <Link
                key={p.id}
                href={`/people/${p.slug}`}
                className="rounded-full border border-curtn-dark/50 px-3 py-1 text-sm text-curtn-cream hover:border-curtn-coral hover:text-curtn-coral transition-colors"
              >
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <EditHistory
        targetKind="ProductionCompany"
        targetId={decodeId(company.id)}
        canEdit={isAdmin}
      />
    </div>
  );
}
