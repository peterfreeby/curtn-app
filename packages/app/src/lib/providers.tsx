"use client";

import { useMemo } from "react";
import { Provider } from "urql";
import { createClient } from "./urql";
import { AuthProvider } from "./auth/AuthContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => createClient(), []);

  return (
    <AuthProvider>
      <Provider value={client}>{children}</Provider>
    </AuthProvider>
  );
}
