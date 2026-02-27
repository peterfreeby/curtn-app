"use client";

import { Client, cacheExchange, fetchExchange } from "urql";

export function createClient() {
  return new Client({
    url: "/api/graphql",
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("curtn_access_token")
          : null;
      return {
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      };
    },
  });
}
