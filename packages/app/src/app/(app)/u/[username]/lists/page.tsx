"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "urql";
import { USER_BY_USERNAME_QUERY } from "@/lib/graphql/users";
import { USER_LISTS_QUERY } from "@/lib/graphql/lists";
import { ListGrid } from "@/components/lists/ListGrid";

function UserListsBrowser() {
  const { username } = useParams<{ username: string }>();

  const [{ data: userData }] = useQuery({
    query: USER_BY_USERNAME_QUERY,
    variables: { username, first: 1 },
  });

  const profileUser = userData?.userList?.edges?.[0]?.node ?? null;

  const [{ data, fetching }] = useQuery({
    query: USER_LISTS_QUERY,
    variables: { userId: profileUser?.id, first: 50 },
    pause: !profileUser,
  });

  const lists = data?.userLists?.edges?.map((e: any) => e.node) ?? [];

  if (!profileUser) {
    return (
      <div className="empty-state">
        <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">User Not Found</p>
      </div>
    );
  }

  return (
    <ListGrid
      lists={lists}
      loading={fetching}
      emptyMessage={`@${username} hasn\u2019t created any public lists yet.`}
    />
  );
}

export default function UserListsPage() {
  const { username } = useParams<{ username: string }>();

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-6">
        @{username}&apos;s Lists
      </h2>
      <Suspense
        fallback={
          <div className="mt-6">
            <ListGrid lists={[]} loading={true} />
          </div>
        }
      >
        <UserListsBrowser />
      </Suspense>
    </div>
  );
}
