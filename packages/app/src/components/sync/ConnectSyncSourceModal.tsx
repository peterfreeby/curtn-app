"use client";

import { useState } from "react";
import { useMutation } from "urql";
import {
  TEST_SYNC_SOURCE_MUTATION,
  CREATE_CLAIMANT_SYNC_MUTATION,
} from "@/lib/graphql/sync";

// Phase 6 — modal flow for connecting an RSS or iCal sync source to a venue
// the user has claimed. Three steps wrapped in one component:
//   1. Choose feed type
//   2. Paste URL + Test fetch (preview items)
//   3. Confirm + save (calls createClaimantSync)

interface PreviewItem {
  title: string | null;
  description: string | null;
  date: string | null;
  time: string | null;
  ticketUrl: string | null;
}

interface Props {
  targetKind: "venue";
  targetId: string;
  targetName: string;
  onClose: () => void;
  onConnected: () => void;
}

export function ConnectSyncSourceModal({
  targetKind,
  targetId,
  targetName,
  onClose,
  onConnected,
}: Props) {
  const [feedType, setFeedType] = useState<"rss" | "ical">("rss");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [step, setStep] = useState<"type" | "url" | "confirm">("type");
  const [error, setError] = useState<string | null>(null);

  const [{ fetching: testing }, executeTest] = useMutation(TEST_SYNC_SOURCE_MUTATION);
  const [{ fetching: saving }, executeCreate] = useMutation(CREATE_CLAIMANT_SYNC_MUTATION);

  async function handleTest() {
    setError(null);
    setPreview(null);
    const result = await executeTest({ input: { feedType, url: url.trim() } });
    const data = result.data?.testSyncSource;
    if (data?.error) {
      setError(data.error);
      return;
    }
    if (!data) {
      setError("No response from server");
      return;
    }
    setPreview(data.preview ?? []);
    setItemCount(data.itemCount ?? 0);
    setStep("confirm");
  }

  async function handleSave() {
    setError(null);
    const result = await executeCreate({
      input: {
        targetKind,
        targetId,
        feedType,
        url: url.trim(),
      },
    });
    const data = result.data?.createClaimantSync;
    if (data?.error) {
      setError(data.error);
      return;
    }
    onConnected();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-lg border border-curtn-dark bg-curtn-surface p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-curtn-coral">
              Connect sync source
            </h2>
            <p className="mt-1 text-xs text-curtn-muted">
              {targetName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-curtn-muted hover:text-curtn-cream transition-colors"
          >
            ×
          </button>
        </div>

        {step === "type" && (
          <div className="space-y-3">
            <p className="text-sm text-curtn-cream">
              Curtn can pull events from your venue's public feed. Pick the format you publish in.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setFeedType("rss")}
                className={`flex-1 rounded-md border px-4 py-3 text-xs uppercase tracking-widest transition-colors ${
                  feedType === "rss"
                    ? "border-curtn-coral bg-curtn-coral/10 text-curtn-coral"
                    : "border-curtn-dark bg-curtn-deep text-curtn-muted hover:text-curtn-cream"
                }`}
              >
                RSS
              </button>
              <button
                onClick={() => setFeedType("ical")}
                className={`flex-1 rounded-md border px-4 py-3 text-xs uppercase tracking-widest transition-colors ${
                  feedType === "ical"
                    ? "border-curtn-coral bg-curtn-coral/10 text-curtn-coral"
                    : "border-curtn-dark bg-curtn-deep text-curtn-muted hover:text-curtn-cream"
                }`}
              >
                iCal
              </button>
            </div>
            <button
              onClick={() => setStep("url")}
              className="w-full rounded-md bg-curtn-coral px-3 py-2 text-xs font-bold text-curtn-deep hover:bg-curtn-red transition-colors"
            >
              Continue →
            </button>
          </div>
        )}

        {step === "url" && (
          <div className="space-y-3">
            <label className="block text-xs uppercase tracking-widest text-curtn-muted">
              {feedType.toUpperCase()} URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                feedType === "rss"
                  ? "https://example.com/events.rss"
                  : "https://example.com/events.ics"
              }
              className="w-full rounded-md border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream placeholder:text-curtn-muted/60 focus:border-curtn-coral focus:outline-none"
            />
            {error && <p className="text-xs text-red-300">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setStep("type")}
                className="rounded-md border border-curtn-dark px-3 py-2 text-xs text-curtn-muted hover:text-curtn-cream"
              >
                Back
              </button>
              <button
                onClick={handleTest}
                disabled={!url.trim() || testing}
                className="flex-1 rounded-md bg-curtn-coral px-3 py-2 text-xs font-bold text-curtn-deep hover:bg-curtn-red transition-colors disabled:opacity-50"
              >
                {testing ? "Testing..." : "Test fetch →"}
              </button>
            </div>
          </div>
        )}

        {step === "confirm" && preview && (
          <div className="space-y-3">
            <p className="text-sm text-curtn-cream">
              Found <span className="font-bold">{itemCount}</span> upcoming event{itemCount === 1 ? "" : "s"}. Preview:
            </p>
            <div className="max-h-48 overflow-y-auto rounded-md border border-curtn-dark bg-curtn-deep p-3 space-y-2">
              {preview.length === 0 ? (
                <p className="text-xs text-curtn-muted">
                  No items in the feed yet. That's okay — Curtn will pick them up when they're published.
                </p>
              ) : (
                preview.map((item, i) => (
                  <div key={i} className="text-xs">
                    <p className="text-curtn-cream font-medium">{item.title ?? "(untitled)"}</p>
                    {item.date && (
                      <p className="text-curtn-muted">
                        {new Date(item.date).toLocaleDateString()} {item.time && `· ${item.time}`}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
            {error && <p className="text-xs text-red-300">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setStep("url")}
                className="rounded-md border border-curtn-dark px-3 py-2 text-xs text-curtn-muted hover:text-curtn-cream"
              >
                Back
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-md bg-curtn-coral px-3 py-2 text-xs font-bold text-curtn-deep hover:bg-curtn-red transition-colors disabled:opacity-50"
              >
                {saving ? "Connecting..." : "Connect sync"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
