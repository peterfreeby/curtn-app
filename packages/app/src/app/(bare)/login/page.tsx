"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithPhoneNumber, ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { useAuth } from "@/lib/auth/useAuth";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

type Step = "phone" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const { firebaseUser, user } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [recaptchaReady, setRecaptchaReady] = useState(false);

  useEffect(() => {
    if (firebaseUser && user?.hasProfile) {
      router.push("/feed");
    }
  }, [firebaseUser, user, router]);

  // Initialize reCAPTCHA once on mount
  useEffect(() => {
    if (!auth || recaptchaReady) return;

    try {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => {
          // reCAPTCHA solved
        },
      });
      // Pre-render the reCAPTCHA widget
      (window as any).recaptchaVerifier.render().then(() => {
        setRecaptchaReady(true);
      });
    } catch (err) {
      console.error("reCAPTCHA setup error:", err);
    }
  }, [recaptchaReady]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!auth) {
      setError("Authentication not initialized.");
      return;
    }

    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length < 10) {
      setError("Enter a valid phone number.");
      return;
    }

    setLoading(true);
    try {
      const formatted = phoneNumber.startsWith("+") ? phoneNumber : `+1${cleaned}`;
      const verifier = (window as any).recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, formatted, verifier);
      setConfirmation(result);
      setStep("otp");
    } catch (err: any) {
      console.error("Phone auth error:", err);
      // Reset reCAPTCHA on failure so it can be retried
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch { /* ignore */ }
        (window as any).recaptchaVerifier = null;
        setRecaptchaReady(false);
      }
      setError(err.message || "Failed to send code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmation) return;

    setError("");
    setLoading(true);
    try {
      await confirmation.confirm(otp);
      // onAuthStateChanged in AuthContext handles the rest
    } catch {
      setError("Invalid code. Check and try again.");
      setOtp("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <Card className="w-full max-w-sm space-y-8">
        {step === "phone" ? (
          <>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
              <p className="text-sm text-curtn-muted">
                Enter your phone number and we&apos;ll send you a code.
              </p>
            </div>

            <form onSubmit={handleSendCode} className="space-y-6">
              <Input
                label="Phone number"
                type="tel"
                placeholder="+1 (555) 555-0100"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
              />

              {error && <p className="text-curtn-coral text-xs">{error}</p>}

              <Button type="submit" fullWidth disabled={loading}>
                {loading ? "Sending..." : "Send Code"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Enter code</h1>
              <p className="text-sm text-curtn-muted">
                We sent a 6-digit code to {phoneNumber}
              </p>
            </div>

            <form onSubmit={handleVerifyCode} className="space-y-6">
              <Input
                label="Verification code"
                type="text"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
              />

              {error && <p className="text-curtn-coral text-xs">{error}</p>}

              <Button type="submit" fullWidth disabled={loading || otp.length < 6}>
                {loading ? "Verifying..." : "Verify"}
              </Button>
            </form>

            <button
              onClick={() => {
                setStep("phone");
                setOtp("");
                setConfirmation(null);
                setError("");
              }}
              className="text-xs text-curtn-muted hover:text-curtn-cream transition-colors"
            >
              Use a different number
            </button>
          </>
        )}

        <div id="recaptcha-container" />

        <p className="text-[10px] text-curtn-dark text-center leading-relaxed">
          Protected by reCAPTCHA. Google{" "}
          <a href="https://policies.google.com/privacy" className="underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a>{" & "}
          <a href="https://policies.google.com/terms" className="underline" target="_blank" rel="noopener noreferrer">Terms</a>.
        </p>
      </Card>
    </main>
  );
}
