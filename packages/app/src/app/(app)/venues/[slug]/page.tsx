import type { Metadata } from "next";
import { getVenueMetadata } from "@/lib/metadata";
import VenueDetailPage from "./_client";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getVenueMetadata(slug);
  if (!data) return { title: "Venue Not Found" };
  return {
    title: data.title,
    description: data.description,
    openGraph: {
      title: data.title,
      description: data.description,
      ...(data.imageUrl && { images: [{ url: data.imageUrl }] }),
    },
  };
}

export default function Page() {
  return <VenueDetailPage />;
}
