"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "../firebase/config";

interface User {
  id: string;
  fullName: string;
  username: string;
  hasProfile: boolean;
  isAdmin: boolean;
  reviewCount: number;
  avatarUrl?: string | null;
}

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  logout: async () => {},
  refreshUser: async () => {},
});

const ME_QUERY = `query { me { id fullName username hasProfile isAdmin reviewCount avatarUrl } }`;

const AUTHENTICATE_MUTATION = `
  mutation AuthenticateWithPhone($idToken: String!) {
    authenticateWithPhone(input: { idToken: $idToken }) {
      user { id fullName username hasProfile isAdmin reviewCount avatarUrl }
      isNewUser
      error
    }
  }
`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async (fbUser: FirebaseUser | null) => {
    if (!fbUser) {
      console.debug("[auth] fetchUser: no firebase user, clearing state");
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const token = await fbUser.getIdToken();
      const headers = {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
      };

      // Try to get existing user
      console.debug("[auth] fetchUser: querying me...");
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers,
        body: JSON.stringify({ query: ME_QUERY }),
      });
      const json = await res.json();
      let me = json.data?.me;
      console.debug("[auth] fetchUser: me query returned", me ? `user ${me.username} (hasProfile: ${me.hasProfile})` : "null");

      // If no MongoDB user exists, create one via authenticateWithPhone
      if (!me) {
        console.debug("[auth] fetchUser: no existing user, calling authenticateWithPhone...");
        const authRes = await fetch("/api/graphql", {
          method: "POST",
          headers,
          body: JSON.stringify({
            query: AUTHENTICATE_MUTATION,
            variables: { idToken: token },
          }),
        });
        const authJson = await authRes.json();
        const result = authJson.data?.authenticateWithPhone;

        if (result?.error) {
          console.error("[auth] authenticateWithPhone failed:", result.error);
          setUser(null);
          setIsLoading(false);
          return;
        }

        if (result?.user) {
          me = result.user;
          console.debug("[auth] fetchUser: user created, isNewUser:", result.isNewUser, "hasProfile:", me.hasProfile);
        }
      }

      setUser(
        me
          ? {
              ...me,
              hasProfile: me.hasProfile ?? false,
              isAdmin: me.isAdmin ?? false,
              reviewCount: me.reviewCount ?? 0,
            }
          : null
      );
      console.debug("[auth] fetchUser: setUser called, hasProfile:", me?.hasProfile, "username:", me?.username);

      // Existing users without a profile also need onboarding
      if (me && !me.hasProfile && !me.username) {
        console.debug("[auth] fetchUser: redirecting to /onboarding");
        router.push("/onboarding");
      }
    } catch (err) {
      console.error("[auth] fetchUser error:", err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      fetchUser(fbUser);
    });

    return unsubscribe;
  }, [fetchUser]);

  const logout = useCallback(async () => {
    if (auth) await firebaseSignOut(auth);
    setUser(null);
    router.push("/");
  }, [router]);

  const refreshUser = useCallback(async () => {
    await fetchUser(firebaseUser);
  }, [fetchUser, firebaseUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      user,
      isAuthenticated: !!user,
      isLoading,
      logout,
      refreshUser,
    }),
    [firebaseUser, user, isLoading, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
