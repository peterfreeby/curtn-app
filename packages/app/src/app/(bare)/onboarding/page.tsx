"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth/useAuth";

export default function OnboardingPage() {
  const router = useRouter();
  const { firebaseUser, refreshUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!username.match(/^[a-zA-Z0-9_]+$/) || username.length < 3) {
      setError("Username must be at least 3 characters — letters, numbers, and underscores only.");
      return;
    }

    if (!firebaseUser) {
      setError("Not authenticated. Try signing in again.");
      return;
    }

    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: `
            mutation CreateProfile($fullName: String!, $username: String!) {
              createProfile(input: { fullName: $fullName, username: $username }) {
                user {
                  id
                  fullName
                  username
                  hasProfile
                }
                error
              }
            }
          `,
          variables: { fullName, username },
        }),
      });

      const json = await res.json();
      const result = json.data?.createProfile;

      if (result?.error) {
        setError(result.error);
      } else if (result?.user) {
        await refreshUser();
        router.push("/browse");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <Card className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Set up your profile</h1>
          <p className="text-sm text-curtn-muted">
            Just a couple things before you get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Your name"
            type="text"
            placeholder="e.g. Jordan Rivera"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <Input
            label="Username"
            type="text"
            placeholder="e.g. jordanr"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          {error && <p className="text-curtn-coral text-xs">{error}</p>}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Setting up..." : "Let's Go"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
