"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function ContentOpsAuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname?.endsWith("/login") ?? false;
  const [state, setState] = useState<"loading" | "ok" | "no">("loading");

  useEffect(() => {
    if (isLogin) {
      setState("ok");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/contentops/session", { credentials: "include" });
        const data = (await res.json()) as { ok?: boolean };
        if (cancelled) return;
        if (data.ok) {
          setState("ok");
          try {
            localStorage.setItem("contentops_session_hint", "1");
          } catch {
            /* ignore */
          }
        } else {
          setState("no");
          router.replace("/admin/contentops/login");
        }
      } catch {
        if (!cancelled) setState("no");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLogin, router]);

  if (!isLogin && state === "loading") {
    return (
      <main>
        <p className="co-muted">Checking session…</p>
        <p>
          <Link href="/">Back to site</Link>
        </p>
      </main>
    );
  }
  if (!isLogin && state === "no") return null;
  return <>{children}</>;
}
