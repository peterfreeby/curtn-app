"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { useAuth } from "@/lib/auth/useAuth";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

type Step = "phone" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);

  useEffect(() => {
    if (firebaseUser) {
      router.push("/feed");
    }
  }, [firebaseUser, router]);

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaRef.current!, {
        size: "invisible",
      });
    }
  };

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length < 10) {
      setError("Enter a valid phone number.");
      return;
    }

    setLoading(true);
    try {
      setupRecaptcha();
      const formatted = phoneNumber.startsWith("+") ? phoneNumber : `+1${cleaned}`;
      const result = await signInWithPhoneNumber(auth, formatted, (window as any).recaptchaVerifier);
      setConfirmation(result);
      setStep("otp");
    } catch (err: any) {
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

        <div ref={recaptchaRef} />
      </Card>
    </main>
  );
}
