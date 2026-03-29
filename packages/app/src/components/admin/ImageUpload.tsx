"use client";

import { useState, useRef } from "react";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface ImageUploadProps {
  entityType: string;
  entityId: string;
  currentImageUrl: string | null;
  onUploaded: (url: string) => void;
  label?: string;
}

export function ImageUpload({
  entityType,
  entityId,
  currentImageUrl,
  onUploaded,
  label,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Accepted formats: JPEG, PNG, WebP, GIF");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File must be under 5 MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();

      if (json.error) {
        setError(json.error);
      } else {
        onUploaded(json.url);
      }
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="font-mono text-[10px] uppercase tracking-[1px] text-curtn-muted block">
          {label}
        </label>
      )}
      <div className="flex items-center gap-3">
        {currentImageUrl && (
          <img
            src={currentImageUrl}
            alt=""
            className="h-16 w-16 rounded-sm object-cover border border-curtn-dark shrink-0"
          />
        )}
        <div className="space-y-1">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="rounded-sm border border-curtn-dark bg-curtn-deep px-3 py-1.5 text-xs text-curtn-cream hover:border-curtn-coral transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading..." : currentImageUrl ? "Replace" : "Upload"}
          </button>
          {error && <p className="text-xs text-curtn-red">{error}</p>}
        </div>
      </div>
    </div>
  );
}
