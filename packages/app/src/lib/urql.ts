"use client";

import { Client, cacheExchange, fetchExchange } from "urql";
import { auth } from "./firebase/config";

export function createClient() {
  return new Client({
    url: "/api/graphql",
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: () => {
      // Firebase SDK caches the current token in memory.
      // For fresh tokens on each request, the AuthContext
      // calls getIdToken() which handles refresh automatically.
      // URQL's sync fetchOptions can't await, so we rely on
      // the token being cached by Firebase after onAuthStateChanged.
      const user = auth?.currentUser;
      // @ts-ignore — accessToken is available on the internal user object
      const token = user?.accessToken as string | undefined;
      return {
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      };
    },
  });
}
