"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/Icons";

export function SearchTrigger() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/performances?focus=search")}
      className="text-curtn-muted hover:text-curtn-cream transition-colors duration-200 p-2 -m-2"
      aria-label="Search"
    >
      <Icon name="magnifying-glass" />
    </button>
  );
}
