import type { Metadata } from "next";
import { getShowMetadata } from "@/lib/metadata";
import ShowDetailPage from "./_client";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getShowMetadata(decodeURIComponent(id));
  if (!data) return { title: "Show Not Found" };
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
  return <ShowDetailPage />;
}
