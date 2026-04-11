"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ToastProps {
  message: string;
  actionLabel?: string;
  actionHref?: string;
  duration?: number;
  onDismiss?: () => void;
}

export function Toast({
  message,
  actionLabel,
  actionHref,
  duration = 8000,
  onDismiss,
}: ToastProps) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 border border-curtn-dark/50 bg-curtn-surface px-5 py-3 shadow-xl transition-all duration-300 ${
        exiting ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
      }`}
    >
      <span className="text-sm text-curtn-cream">{message}</span>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="text-sm font-medium text-curtn-coral hover:text-curtn-red transition-colors whitespace-nowrap"
        >
          {actionLabel}
        </Link>
      )}
      <button
        type="button"
        onClick={() => {
          setExiting(true);
          setTimeout(() => {
            setVisible(false);
            onDismiss?.();
          }, 300);
        }}
        className="text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer ml-1"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}
