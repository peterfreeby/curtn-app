import type { Metadata } from "next";
import { getPersonMetadata } from "@/lib/metadata";
import PersonDetailPage from "./_client";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPersonMetadata(slug);
  if (!data) return { title: "Person Not Found" };
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
  return <PersonDetailPage />;
}
