import type { Metadata } from "next";
import { getUserMetadata } from "@/lib/metadata";
import ProfilePage from "./_client";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const data = await getUserMetadata(username);
  if (!data) return { title: "User Not Found" };
  return {
    title: data.title,
    description: data.description,
    openGraph: {
      title: `${data.title} — Curtn`,
      description: data.description,
      ...(data.imageUrl && { images: [{ url: data.imageUrl }] }),
    },
  };
}

export default function Page() {
  return <ProfilePage />;
}
