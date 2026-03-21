"use client";

import { useState, useRef } from "react";
import { useMutation } from "urql";
import { USER_PROFILE_UPDATE_MUTATION } from "@/lib/graphql/users";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

interface EditProfileModalProps {
  fullName: string;
  bio: string;
  avatarUrl: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditProfileModal({
  fullName: initialName,
  bio: initialBio,
  avatarUrl: initialAvatar,
  onClose,
  onSaved,
}: EditProfileModalProps) {
  const [fullName, setFullName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [avatarPreview, setAvatarPreview] = useState(initialAvatar);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [{ fetching }, executeUpdate] = useMutation(USER_PROFILE_UPDATE_MUTATION);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarPreview(URL.createObjectURL(file));
    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "user");
      formData.append("entityId", "avatar");

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        setAvatarPreview(initialAvatar);
        return;
      }

      setAvatarUrl(data.url);
    } catch {
      setError("Upload failed");
      setAvatarPreview(initialAvatar);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setError("");

    const input: Record<string, string> = {};
    if (fullName.trim() !== initialName) input.fullName = fullName.trim();
    if (bio !== initialBio) input.bio = bio;
    if (avatarUrl !== initialAvatar && avatarUrl) input.avatarUrl = avatarUrl;

    if (Object.keys(input).length === 0) {
      onClose();
      return;
    }

    const result = await executeUpdate({ input });

    if (result.error) {
      setError("Failed to save");
      return;
    }
    if (result.data?.userProfileUpdate?.error) {
      setError(result.data.userProfileUpdate.error);
      return;
    }

    onSaved();
    onClose();
  }

  const initial = fullName.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <Card className="w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-curtn-cream">Edit Profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative h-20 w-20 shrink-0 rounded-full overflow-hidden cursor-pointer group"
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-curtn-coral text-curtn-deep text-3xl font-bold select-none">
                {initial}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs text-white font-medium">
                {uploading ? "..." : "Change"}
              </span>
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <p className="text-xs text-curtn-muted">
            Click to upload a new photo. JPEG, PNG, or WebP.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-curtn-muted mb-1">Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream placeholder:text-curtn-muted/40 focus:border-curtn-coral focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-curtn-muted mb-1">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={160}
              placeholder="Tell people a bit about yourself..."
              className="w-full border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream placeholder:text-curtn-muted/40 focus:border-curtn-coral focus:outline-none resize-none"
            />
            <p className="text-right text-[11px] text-curtn-muted/50">
              {bio.length}/160
            </p>
          </div>
        </div>

        {error && (
          <p className="text-xs text-curtn-red">{error}</p>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="border border-curtn-dark px-4 py-2 text-sm text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={fetching || uploading || !fullName.trim()}
          >
            {fetching ? "Saving..." : "Save"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
