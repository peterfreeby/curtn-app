"use client";

import { ListCreateForm } from "@/components/lists/ListCreateForm";

export default function NewListPage() {
  return (
    <div className="px-4 sm:px-6 py-8 max-w-lg mx-auto">
      <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-6">
        Create a List
      </h2>
      <ListCreateForm />
    </div>
  );
}
