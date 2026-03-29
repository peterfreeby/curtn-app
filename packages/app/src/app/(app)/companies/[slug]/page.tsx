import type { Metadata } from "next";
import { getCompanyMetadata } from "@/lib/metadata";
import CompanyDetailPage from "./_client";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCompanyMetadata(slug);
  if (!data) return { title: "Company Not Found" };
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
  return <CompanyDetailPage />;
}
