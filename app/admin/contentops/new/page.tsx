"use client";

import {
  BALER_MODEL_OPTIONS,
  DEFAULT_MACHINE_MODELS,
  MACHINE_FAMILY_OPTIONS,
  normalizeContentOpsMachineFamily,
  PLATFORM_OPTIONS,
  TOPIC_OPTIONS,
} from "@/lib/contentops-constants";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoadingOverlay } from "@/components/contentops/loading-overlay";

type IncomingFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string | null;
};

type CreatePostResponse = {
  postId: string;
  sheetSyncFailed?: boolean;
  error?: string;
};

function extLabel(name: string): string {
  const parts = name.split(".");
  if (parts.length < 2) return "FILE";
  return parts.at(-1)?.slice(0, 6).toUpperCase() || "FILE";
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export default function ContentOpsNewPostPage() {
  const router = useRouter();
  const [files, setFiles] = useState<IncomingFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [machineFamily, setMachineFamily] = useState<string>(MACHINE_FAMILY_OPTIONS[0]);
  const [machineModel, setMachineModel] = useState<string>("");
  const [knownModels, setKnownModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelFetchFailed, setModelFetchFailed] = useState(false);
  const [emptyApiModels, setEmptyApiModels] = useState(false);

  const [modelOpen, setModelOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const modelWrapRef = useRef<HTMLDivElement | null>(null);

  const [balerPreset, setBalerPreset] = useState<string>(BALER_MODEL_OPTIONS[0]);
  const [customBalerModel, setCustomBalerModel] = useState<string>("");

  const [topic, setTopic] = useState<string>(TOPIC_OPTIONS[0]);
  const [location, setLocation] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["FB", "IG"]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [loadedCount, setLoadedCount] = useState<number | null>(null);

  const canonicalMachineFamily = useMemo(() => normalizeContentOpsMachineFamily(machineFamily), [machineFamily]);
  const isBaler = canonicalMachineFamily === "Baler";

  const combinedSuggestions = useMemo(() => {
    const fallback = DEFAULT_MACHINE_MODELS[canonicalMachineFamily] ?? [];
    const merged = [...knownModels, ...fallback];
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const m of merged) {
      const key = norm(m);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push(m);
    }
    deduped.sort((a, b) => a.localeCompare(b));
    return deduped;
  }, [knownModels, canonicalMachineFamily]);

  const filteredSuggestions = useMemo(() => {
    const q = norm(machineModel);
    if (!q) return combinedSuggestions;
    return combinedSuggestions.filter((m) => norm(m).includes(q));
  }, [combinedSuggestions, machineModel]);

  const effectiveMachineModel = useMemo(() => {
    if (isBaler) {
      if (balerPreset === "Other") return customBalerModel.trim() || null;
      return balerPreset;
    }
    return machineModel.trim() || null;
  }, [isBaler, machineModel, balerPreset, customBalerModel]);

  /** Balers: presets (no "Other") + API models + defaults, deduped case-insensitively; "Other" last. */
  const balerSelectOptions = useMemo(() => {
    if (canonicalMachineFamily !== "Baler") return [];
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (label: string) => {
      const k = norm(label);
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push(label);
    };
    for (const m of BALER_MODEL_OPTIONS) {
      if (m === "Other") continue;
      add(m);
    }
    for (const m of knownModels) add(m);
    for (const m of DEFAULT_MACHINE_MODELS[canonicalMachineFamily] ?? []) add(m);
    return [...out, "Other"];
  }, [canonicalMachineFamily, knownModels]);

  const load = useCallback(async () => {
    setLoadingFiles(true);
    setError(null);
    try {
      const res = await fetch("/api/contentops/incoming", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to load incoming");
        setFiles([]);
        setLoadedCount(0);
        return;
      }
      const incoming = (data as { files: IncomingFile[] }).files ?? [];
      setFiles(incoming);
      setLoadedCount(incoming.length);
      setSelected((prev) => {
        const valid = new Set(incoming.map((f) => f.id));
        return new Set(Array.from(prev).filter((id) => valid.has(id)));
      });
    } catch {
      setError("Network error loading incoming");
      setFiles([]);
      setLoadedCount(0);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  const loadKnownModels = useCallback(async (canonicalFamily: string) => {
    setLoadingModels(true);
    setModelFetchFailed(false);
    setEmptyApiModels(false);
    try {
      const res = await fetch(
        `/api/contentops/machine-models?family=${encodeURIComponent(canonicalFamily)}&t=${Date.now()}`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );
      let parsed: unknown;
      try {
        parsed = await res.json();
      } catch {
        setKnownModels([]);
        setEmptyApiModels(false);
        setModelFetchFailed(true);
        return;
      }
      const data = parsed as { ok?: boolean; models?: string[]; error?: string };
      const modelsOk = res.ok && data.ok !== false;
      if (modelsOk) {
        const list = (data.models ?? []).slice().sort((a, b) => a.localeCompare(b));
        setKnownModels(list);
        setEmptyApiModels(list.length === 0);
        setModelFetchFailed(false);
      } else {
        setKnownModels([]);
        setEmptyApiModels(false);
        setModelFetchFailed(true);
      }
    } catch {
      setKnownModels([]);
      setEmptyApiModels(false);
      setModelFetchFailed(true);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadKnownModels(canonicalMachineFamily);
    setMachineModel("");
    setModelOpen(false);
    setHighlightIdx(-1);
  }, [canonicalMachineFamily, loadKnownModels]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!modelWrapRef.current) return;
      if (!modelWrapRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (!modelOpen) setHighlightIdx(-1);
  }, [modelOpen]);

  function togglePlatform(id: string) {
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function toggleFile(id: string) {
    if (loadingFiles || busy) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pickSuggestion(value: string) {
    setMachineModel(value);
    setModelOpen(false);
    setHighlightIdx(-1);
  }

  return (
    <main className="co-stack" style={{ padding: "1.25rem", position: "relative" }}>
      <LoadingOverlay open={busy} text="Creating post, moving files, generating drafts..." fullscreen />

      <div className="co-row" style={{ justifyContent: "space-between", width: "100%" }}>
        <h1 style={{ margin: 0 }}>New post</h1>
        <button type="button" className="co-btn" onClick={() => void load()} disabled={loadingFiles || busy}>
          Refresh
        </button>
      </div>

      {error ? <p style={{ color: "var(--danger)", fontWeight: 600 }}>{error}</p> : null}

      <section className="co-panel co-stack" style={{ position: "relative" }}>
        <LoadingOverlay open={loadingFiles} text="Loading incoming files..." />

        <h2 style={{ marginTop: 0 }}>1. Select Drive files</h2>
        <p className="co-muted">Choose one or more files already in Incoming folder.</p>
        {!loadingFiles && loadedCount !== null ? <p className="co-muted">Loaded {loadedCount} files.</p> : null}
        {!loadingFiles && files.length === 0 ? (
          <div className="co-empty-state">
            <p>No files found in Incoming folder. Upload to Drive Incoming then click Refresh.</p>
          </div>
        ) : null}

        <div className="co-grid">
          {(loadingFiles ? Array.from({ length: 8 }) : files).map((f, index) => {
            if (loadingFiles) return <div key={`skeleton-${index}`} className="co-thumb co-skeleton" aria-hidden="true" />;
            const item = f as IncomingFile;
            const isSel = selected.has(item.id);
            return (
              <div key={item.id} className={`co-thumb${isSel ? " selected" : ""}`}>
                <button
                  type="button"
                  onClick={() => toggleFile(item.id)}
                  style={{ all: "unset", display: "block", cursor: "pointer" }}
                  disabled={busy || loadingFiles}
                >
                  {item.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/contentops/drive/file?id=${encodeURIComponent(item.id)}`} alt={item.name} />
                  ) : (
                    <div className="co-file-placeholder">{extLabel(item.name)}</div>
                  )}
                </button>

                <div style={{ padding: "0.35rem 0.5rem", fontSize: "0.8rem" }}>
                  <div className="co-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <strong style={{ maxWidth: "80%", wordBreak: "break-word" }}>{item.name}</strong>
                    {isSel ? <span className="co-check-pill">Selected</span> : null}
                  </div>
                  {item.webViewLink ? (
                    <a href={item.webViewLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                      Open in Drive ↗
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="co-panel co-stack">
        <h2 style={{ marginTop: 0 }}>2. Metadata</h2>

        <label className="co-stack">
          <span className="co-muted">Machine family</span>
          <select className="co-select" value={machineFamily} onChange={(e) => setMachineFamily(e.target.value)} disabled={busy}>
            {MACHINE_FAMILY_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        {isBaler ? (
          <>
            <label className="co-stack">
              <span className="co-muted">Machine model/type</span>
              <select className="co-select" value={balerPreset} onChange={(e) => setBalerPreset(e.target.value)} disabled={busy}>
                {balerSelectOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            {balerPreset === "Other" ? (
              <label className="co-stack">
                <span className="co-muted">Custom baler model</span>
                <input className="co-input" value={customBalerModel} onChange={(e) => setCustomBalerModel(e.target.value)} disabled={busy} />
              </label>
            ) : null}
          </>
        ) : (
          <div className="co-stack" ref={modelWrapRef}>
            <div className="co-row" style={{ justifyContent: "space-between" }}>
              <span className="co-muted">Machine model/type</span>
              <div className="co-row" style={{ gap: "0.5rem" }}>
                {loadingModels ? <span className="co-muted">Loading models...</span> : null}
                {!loadingModels && modelFetchFailed ? (
                  <span className="co-muted">Model suggestions failed to load. Click Refresh models.</span>
                ) : null}
                <button
                  type="button"
                  className="co-btn"
                  onClick={() => void loadKnownModels(canonicalMachineFamily)}
                  disabled={busy || loadingModels}
                >
                  Refresh models
                </button>
              </div>
            </div>
            {!loadingModels && !modelFetchFailed && emptyApiModels ? (
              <p className="co-muted" style={{ margin: 0 }}>
                No saved models yet — you can type one and it will be remembered.
              </p>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.4rem", position: "relative" }}>
              <input
                className="co-input"
                style={{ maxWidth: "none" }}
                value={machineModel}
                onChange={(e) => {
                  setMachineModel(e.target.value);
                  setModelOpen(true);
                }}
                onFocus={() => setModelOpen(true)}
                onKeyDown={(e) => {
                  if (!modelOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                    setModelOpen(true);
                    return;
                  }
                  if (!modelOpen) return;

                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightIdx((idx) => Math.min(idx + 1, filteredSuggestions.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightIdx((idx) => Math.max(idx - 1, 0));
                  } else if (e.key === "Enter") {
                    if (highlightIdx >= 0 && highlightIdx < filteredSuggestions.length) {
                      e.preventDefault();
                      pickSuggestion(filteredSuggestions[highlightIdx]!);
                    }
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setModelOpen(false);
                  }
                }}
                placeholder="Type or choose a model"
                disabled={busy}
              />
              <button type="button" className="co-btn" onClick={() => setModelOpen((v) => !v)} disabled={busy}>
                ▼
              </button>

              {modelOpen ? (
                <div
                  className="co-panel"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    padding: "0.35rem",
                    maxHeight: 220,
                    overflowY: "auto",
                    zIndex: 30,
                  }}
                >
                  {filteredSuggestions.length === 0 ? <p className="co-muted">No suggestions</p> : null}
                  {filteredSuggestions.map((m, idx) => {
                    const active = idx === highlightIdx;
                    return (
                      <button
                        key={`${m}-${idx}`}
                        type="button"
                        className="co-btn"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickSuggestion(m)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          marginBottom: "0.25rem",
                          background: active ? "var(--accent)" : undefined,
                          color: active ? "#042f2e" : undefined,
                        }}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        )}

        <label className="co-stack">
          <span className="co-muted">Topic</span>
          <select className="co-select" value={topic} onChange={(e) => setTopic(e.target.value)} disabled={busy}>
            {TOPIC_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>

        <label className="co-stack">
          <span className="co-muted">Location (optional)</span>
          <input className="co-input" value={location} onChange={(e) => setLocation(e.target.value)} disabled={busy} />
        </label>

        <div className="co-stack">
          <span className="co-muted">Platforms</span>
          <div className="co-row">
            {PLATFORM_OPTIONS.map((p) => (
              <label key={p.id} className="co-row">
                <input type="checkbox" checked={platforms.includes(p.id)} onChange={() => togglePlatform(p.id)} disabled={busy} />
                {p.label}
              </label>
            ))}
          </div>
        </div>
      </section>

      <div className="co-row">
        <button
          type="button"
          className="co-btn primary"
          disabled={busy || loadingFiles}
          onClick={async () => {
            if (selected.size === 0) {
              setError("Select at least 1 Drive file before creating a post.");
              return;
            }
            if (platforms.length === 0) {
              setError("Select at least 1 platform before creating a post.");
              return;
            }

            setBusy(true);
            setError(null);
            try {
              const res = await fetch("/api/contentops/posts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  machineFamily: canonicalMachineFamily,
                  machineModel: effectiveMachineModel,
                  topic,
                  location: location.trim() || null,
                  platforms,
                  driveFileIds: Array.from(selected),
                }),
              });
              const data = (await res.json()) as CreatePostResponse;
              if (!res.ok) {
                setError(data.error ?? "Create failed");
                return;
              }
              await loadKnownModels(canonicalMachineFamily);
              const postId = data.postId;
              const suffix = data.sheetSyncFailed ? "?sheetSyncFailed=1" : "";
              router.push(`/admin/contentops/${postId}${suffix}`);
            } catch {
              setError("Network error");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Processing..." : "Create post & drafts"}
        </button>
      </div>
    </main>
  );
}