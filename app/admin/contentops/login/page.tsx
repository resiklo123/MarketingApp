"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ContentOpsLoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main className="co-stack" style={{ maxWidth: 420 }}>
      <h1>ContentOps login</h1>
      <p className="co-muted">Enter the internal passcode configured in CONTENTOPS_PASSCODE.</p>
      <form
        className="co-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/contentops/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ passcode }),
            });
            if (!res.ok) {
              const j = (await res.json().catch(() => ({}))) as { error?: string };
              setError(j.error ?? "Login failed");
              setBusy(false);
              return;
            }
            try {
              localStorage.setItem("contentops_session_hint", "1");
            } catch {
              /* ignore */
            }
            router.replace("/admin/contentops");
            router.refresh();
          } catch {
            setError("Network error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          className="co-input"
          type="password"
          autoComplete="off"
          placeholder="Passcode"
          value={passcode}
          onChange={(ev) => setPasscode(ev.target.value)}
        />
        {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
        <button className="co-btn primary" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
