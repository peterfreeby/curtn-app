"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
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
            mutation UserCreate($fullName: String!, $username: String!, $email: String!, $password: String!) {
              userCreate(input: { fullName: $fullName, username: $username, email: $email, password: $password }) {
                token {
                  accessToken
                  refreshToken
                }
                error
              }
            }
          `,
          variables: { fullName, username, email, password },
        }),
      });

      const json = await res.json();
      const result = json.data?.userCreate;

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
          <h1 className="text-3xl font-bold tracking-tight">Create account</h1>
          <p className="text-sm text-curtn-muted">Join the community.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Full Name"
            type="text"
            placeholder="Your name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <Input
            label="Username"
            type="text"
            placeholder="Pick a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
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
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p className="text-curtn-coral text-xs">{error}</p>
          )}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <p className="text-xs text-curtn-muted text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-curtn-coral hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
