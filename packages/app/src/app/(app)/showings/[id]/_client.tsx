"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "urql";
import { SINGLE_PERFORMANCE_QUERY } from "@/lib/graphql/performances";

export default function PerformanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(params.id as string);

  const [{ data, fetching }] = useQuery({
    query: SINGLE_PERFORMANCE_QUERY,
    variables: { id },
  });

  const performance = data?.singlePerformance;
  const runId = performance?.run?.id;

  useEffect(() => {
    if (runId) {
      router.replace(`/runs/${encodeURIComponent(runId)}`);
    }
  }, [runId, router]);

  if (fetching || runId) {
    return (
      <div className="px-4 py-8 max-w-lg mx-auto animate-pulse space-y-4">
        <div className="h-8 w-3/4 bg-curtn-dark/60" />
        <div className="h-4 w-1/2 bg-curtn-dark/60" />
      </div>
    );
  }

  return (
    <div className="px-4 py-8 max-w-lg mx-auto">
      <p className="text-curtn-muted text-sm">Performance not found.</p>
    </div>
  );
}
