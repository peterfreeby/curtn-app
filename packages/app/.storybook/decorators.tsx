import React, { useMemo } from "react";
import type { Decorator } from "@storybook/react";
import { Provider as UrqlProvider } from "urql";
import { AuthContext } from "../src/lib/auth/AuthContext";
import { NowViewingProvider } from "../src/lib/NowViewingContext";
import { createStoryClient } from "../src/lib/storybook/testClient";

const defaultUser = {
  id: "story-user-1",
  fullName: "Story Viewer",
  username: "storyviewer",
  hasProfile: true,
  isAdmin: false,
  reviewCount: 12,
  avatarUrl: null,
};

const defaultAuthValue = {
  firebaseUser: null,
  user: defaultUser,
  isAuthenticated: true,
  isLoading: false,
  logout: async () => {},
  refreshUser: async () => {},
};

const signedOutAuthValue = {
  ...defaultAuthValue,
  user: null,
  isAuthenticated: false,
};

const adminAuthValue = {
  ...defaultAuthValue,
  user: { ...defaultUser, isAdmin: true },
};

export const withProviders: Decorator = (Story, context) => {
  const mockData = (context.parameters?.urqlMockData ?? {}) as Record<string, unknown>;
  const authMode = context.parameters?.auth as "signed-in" | "signed-out" | "admin" | undefined;

  const client = useMemo(() => createStoryClient(mockData), [JSON.stringify(mockData)]);
  const authValue =
    authMode === "signed-out" ? signedOutAuthValue :
    authMode === "admin" ? adminAuthValue :
    defaultAuthValue;

  return (
    <AuthContext.Provider value={authValue}>
      <NowViewingProvider>
        <UrqlProvider value={client}>
          <Story />
        </UrqlProvider>
      </NowViewingProvider>
    </AuthContext.Provider>
  );
};
