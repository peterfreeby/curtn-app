"use client";

import { useMemo } from "react";
import { Provider } from "urql";
import { createClient } from "./urql";

export function Providers({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => createClient(), []);

  return <Provider value={client}>{children}</Provider>;
}
