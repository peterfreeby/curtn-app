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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async (fbUser: FirebaseUser | null) => {
    if (!fbUser) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const token = await fbUser.getIdToken();
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: ME_QUERY }),
      });
      const json = await res.json();
      const me = json.data?.me;
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
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      fetchUser(fbUser);
    });

    return unsubscribe;
  }, [fetchUser]);

  const logout = useCallback(async () => {
    await firebaseSignOut(auth);
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
