"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation LoginUser($email: String!, $password: String!) {
              loginUser(input: { email: $email, password: $password }) {
                token {
                  accessToken
                  refreshToken
                }
                error
              }
            }
          `,
          variables: { email, password },
        }),
      });

      const json = await res.json();
      const result = json.data?.loginUser;

      if (result?.error) {
        setError(result.error);
      } else if (result?.token) {
        localStorage.setItem("curtn_access_token", result.token.accessToken);
        localStorage.setItem("curtn_refresh_token", result.token.refreshToken);
        router.push("/reviews");
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
          <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
          <p className="text-sm text-curtn-muted">Welcome back to Curtn.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p className="text-curtn-coral text-xs">{error}</p>
          )}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="text-xs text-curtn-muted text-center">
          No account?{" "}
          <Link href="/signup" className="text-curtn-coral hover:underline">
            Create one
          </Link>
        </p>
      </Card>
    </main>
  );
}
