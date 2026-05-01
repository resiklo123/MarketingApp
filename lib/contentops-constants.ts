export const MACHINE_FAMILY_OPTIONS = [
  "Balers",
  "Shredder",
  "Granulator",
  "Extrusion line",
  "Wash line",
  "Pelletizer",
  "Other",
] as const;

export const MACHINE_OPTIONS = MACHINE_FAMILY_OPTIONS;

export const BALER_MODEL_OPTIONS = ["RHB-5T", "RHB-10T", "RHB-20T", "Other"] as const;

export const DEFAULT_MACHINE_MODELS: Record<string, string[]> = {
  Baler: ["RHB-5T", "RHB-10T", "RHB-20T"],
  Granulator: ["RPC300", "RPC500", "RPC600"],
  Shredder: ["DASh 150", "DASh 200", "DASh 300", "DASh 600"],
  Sifter: ["RS100", "RS150", "RS180"],
};

const KNOWN_MACHINE_FAMILY_CANONICAL = new Map<string, string>([
  ["baler", "Baler"],
  ["balers", "Baler"],
  ["shredder", "Shredder"],
  ["granulator", "Granulator"],
  ["sifter", "Sifter"],
  ["extrusion line", "Extrusion line"],
  ["wash line", "Wash line"],
  ["pelletizer", "Pelletizer"],
  ["other", "Other"],
]);

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Canonical DB / API family: Balers/Baler → "Baler"; known UI labels keep fixed spelling. */
export function normalizeContentOpsMachineFamily(value: string): string {
  const collapsed = value.trim().replace(/\s+/g, " ");
  if (!collapsed) return "";
  const key = collapsed.toLowerCase();
  const known = KNOWN_MACHINE_FAMILY_CANONICAL.get(key);
  if (known) return known;
  return titleCaseWords(collapsed);
}

export const TOPIC_OPTIONS = [
  "Process spotlight",
  "Safety",
  "Customer story",
  "Behind the scenes",
  "Product shot",
  "Product / material",
  "Tip / education",
  "Other",
] as const;

export const PLATFORM_OPTIONS = [
  { id: "FB", label: "Facebook" },
  { id: "IG", label: "Instagram" },
  { id: "TIKTOK", label: "TikTok" },
  { id: "YOUTUBE", label: "YouTube" },
  { id: "WEBSITE", label: "Website" },
] as const;

export function defaultCtaUrl(): string {
  return process.env.CONTENTOPS_CTA_URL?.trim() || "https://resiklo.com";
}