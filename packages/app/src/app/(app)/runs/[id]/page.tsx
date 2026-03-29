import type { Metadata } from "next";
import { getRunMetadata } from "@/lib/metadata";
import RunDetailPage from "./_client";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getRunMetadata(decodeURIComponent(id));
  if (!data) return { title: "Production Not Found" };
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
  return <RunDetailPage />;
}
