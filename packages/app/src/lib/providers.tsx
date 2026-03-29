"use client";

import { useMemo } from "react";
import { Provider } from "urql";
import { createClient } from "./urql";
import { AuthProvider } from "./auth/AuthContext";
import { NowViewingProvider } from "./NowViewingContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => createClient(), []);

  return (
    <AuthProvider>
      <NowViewingProvider>
        <Provider value={client}>{children}</Provider>
      </NowViewingProvider>
    </AuthProvider>
  );
}
