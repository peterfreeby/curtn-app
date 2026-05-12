"use client";

import { useParams } from "next/navigation";
import { useQuery } from "urql";
import { PERSON_BY_SLUG_QUERY } from "@/lib/graphql/people";
import { PersonHero } from "@/components/people/PersonHero";
import { PersonCredits } from "@/components/people/PersonCredits";
import { ClaimPersonButton } from "@/components/people/ClaimPersonButton";
import { AddToListButton } from "@/components/lists/AddToListButton";
import { EditHistory } from "@/components/auditLog/EditHistory";
import { useAuth } from "@/lib/auth/useAuth";

function decodeId(globalId: string): string {
  return atob(globalId).split(":")[1];
}

export default function PersonDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;

  const [{ data, fetching }, reexecute] = useQuery({
    query: PERSON_BY_SLUG_QUERY,
    variables: { slug },
  });

  const person = data?.personBySlug;

  if (fetching) {
    return (
      <div className="px-2 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto animate-pulse space-y-4">
        <div className="flex gap-6">
          <div className="h-24 w-24 rounded-full bg-curtn-dark/60 shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-8 w-2/3 rounded bg-curtn-dark/60" />
            <div className="h-4 w-full rounded bg-curtn-dark/60" />
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <div className="h-4 w-16 rounded bg-curtn-dark/60" />
          <div className="h-16 rounded-lg bg-curtn-dark/60" />
          <div className="h-16 rounded-lg bg-curtn-dark/60" />
        </div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="px-2 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto">
        <p className="text-curtn-muted text-sm">Person not found.</p>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto space-y-8">
      <PersonHero
        name={person.name}
        bio={person.bio}
        headshotUrl={person.headshotUrl}
      />

      <div className="flex items-center gap-3">
        <AddToListButton itemId={person.id} listType="people" />
        <ClaimPersonButton
          personId={person.id}
          isClaimed={person.isClaimed ?? false}
          claimedByUser={person.user}
          onClaimed={() => reexecute({ requestPolicy: "network-only" })}
        />
      </div>

      <PersonCredits
        castCredits={person.castCredits ?? []}
        crewCredits={person.crewCredits ?? []}
        showCredits={person.showCredits ?? []}
      />

      <EditHistory
        targetKind="Person"
        targetId={decodeId(person.id)}
        canEdit={isAdmin}
      />
    </div>
  );
}
