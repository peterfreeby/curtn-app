import Link from "next/link";
import { Button } from "@/components/Button";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-7xl sm:text-8xl font-bold tracking-tight text-curtn-cream">
          Curtn
        </h1>

        <p className="text-xl sm:text-2xl text-curtn-muted font-light leading-relaxed">
          The stage is yours.
        </p>

        <p className="text-sm text-curtn-muted/70 max-w-md mx-auto leading-relaxed">
          Track live performances. Share what moved you.
          <br />
          A community for the people who show up.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link href="/signup">
            <Button variant="primary">Get Started</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">Sign In</Button>
          </Link>
        </div>
      </div>

      <footer className="absolute bottom-8 text-xs text-curtn-muted/40 tracking-widest uppercase">
        Brooklyn, NY
      </footer>
    </main>
  );
}
