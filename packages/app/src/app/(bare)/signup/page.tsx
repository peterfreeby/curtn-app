"use client";

import { redirect } from "next/navigation";

// With phone auth, there's no separate signup flow.
// Login handles both new and returning users.
export default function SignupPage() {
  redirect("/login");
}
