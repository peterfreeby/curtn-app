import type { Metadata } from "next";
import { getPerformanceMetadata } from "@/lib/metadata";
import PerformanceDetailPage from "./_client";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getPerformanceMetadata(decodeURIComponent(id));
  if (!data) return { title: "Performance Not Found" };
  return {
    title: data.title,
    description: data.description,
    openGraph: {
      title: data.title,
      description: data.description,
      ...(data.posterUrl && { images: [{ url: data.posterUrl }] }),
    },
  };
}

export default function Page() {
  return <PerformanceDetailPage />;
}
