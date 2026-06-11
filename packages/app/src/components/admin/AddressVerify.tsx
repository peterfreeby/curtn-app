"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { getStoredAccessToken } from "@/lib/auth/token";

const AddressPreviewMap = dynamic(
  () => import("./AddressPreviewMap").then((m) => m.AddressPreviewMap),
  { ssr: false, loading: () => <div className="h-40 w-full bg-curtn-deep" /> }
);

export interface VerifiedCoords {
  lat: number;
  lng: number;
}

interface AddressVerifyProps {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  // Initial coords from the saved venue (so an already-placed pin shows on open).
  initialCoords?: VerifiedCoords | null;
  // Fires with coords when an address verifies, or null when verification is
  // cleared / fails. The parent stores these and sends them on save.
  onResolved: (coords: VerifiedCoords | null) => void;
}

type Status = "idle" | "loading" | "found" | "notfound" | "error";

function composeQuery(p: { address: string; city: string; state: string; zipCode: string }): string {
  return [p.address, p.city, p.state, p.zipCode]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

export function AddressVerify({
  address,
  city,
  state,
  zipCode,
  initialCoords,
  onResolved,
}: AddressVerifyProps) {
  const [status, setStatus] = useState<Status>(initialCoords ? "found" : "idle");
  const [coords, setCoords] = useState<VerifiedCoords | null>(initialCoords ?? null);
  const [matchedAddress, setMatchedAddress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // The address string the current pin was verified against. If the form's
  // address drifts from this, the pin is stale and must be re-verified.
  const [verifiedQuery, setVerifiedQuery] = useState<string | null>(
    initialCoords ? composeQuery({ address, city, state, zipCode }) : null
  );

  const currentQuery = composeQuery({ address, city, state, zipCode });
  const isStale = status === "found" && verifiedQuery !== null && currentQuery !== verifiedQuery;

  // When the address drifts from what was verified, drop the coords so the
  // parent won't save a pin that no longer matches the typed address.
  useEffect(() => {
    if (isStale) onResolved(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStale]);

  async function verify() {
    if (!currentQuery) {
      setStatus("notfound");
      setMessage("Enter an address to verify.");
      onResolved(null);
      return;
    }
    setStatus("loading");
    setMessage(null);
    try {
      const token = getStoredAccessToken();
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ address, city, state, zipCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Verification failed.");
        onResolved(null);
        return;
      }
      if (data.found) {
        const c = { lat: data.lat, lng: data.lng };
        setCoords(c);
        setMatchedAddress(data.matchedAddress ?? null);
        setVerifiedQuery(currentQuery);
        setStatus("found");
        onResolved(c);
      } else {
        setStatus("notfound");
        setMatchedAddress(null);
        setMessage("Couldn't find that address — check the street, city, and state.");
        onResolved(null);
      }
    } catch {
      setStatus("error");
      setMessage("Network error — try again.");
      onResolved(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={verify}
          disabled={status === "loading"}
          className="dog-ear-sm bg-curtn-coral px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-curtn-deep transition-colors hover:bg-curtn-red disabled:opacity-50"
        >
          {status === "loading" ? "Verifying…" : "Verify address"}
        </button>
        {status === "found" && !isStale && (
          <span className="text-xs text-curtn-acid">✓ Located on map</span>
        )}
        {isStale && (
          <span className="text-xs text-curtn-muted">Address changed — verify again</span>
        )}
        {(status === "notfound" || status === "error") && (
          <span className="text-xs text-curtn-red">✗ {message}</span>
        )}
      </div>

      {matchedAddress && status === "found" && !isStale && (
        <p className="text-xs text-curtn-muted">Matched: {matchedAddress}</p>
      )}

      {status === "found" && !isStale && coords && (
        <div className="overflow-hidden border border-curtn-dark">
          <AddressPreviewMap lat={coords.lat} lng={coords.lng} className="h-40 w-full" />
        </div>
      )}
    </div>
  );
}
