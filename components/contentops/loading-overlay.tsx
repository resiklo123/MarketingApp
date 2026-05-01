"use client";

type LoadingOverlayProps = {
  open: boolean;
  text?: string;
  fullscreen?: boolean;
};

export function LoadingOverlay({ open, text = "Loading...", fullscreen = false }: LoadingOverlayProps) {
  if (!open) return null;
  return (
    <div className={`co-loading-overlay${fullscreen ? " co-loading-overlay-fullscreen" : ""}`} role="status" aria-live="polite">
      <div className="co-spinner" />
      <p>{text}</p>
    </div>
  );
}