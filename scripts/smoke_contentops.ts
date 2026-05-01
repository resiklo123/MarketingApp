import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config();

/**
 * Smoke is a short-lived local script. If DATABASE_URL points at a pooler that breaks Prisma prepared
 * statements, defaulting the Prisma client URL to DIRECT_URL (when unset) keeps this script reliable.
 * The Next.js app still uses DATABASE_URL unless you set CONTENTOPS_PRISMA_DATABASE_URL yourself.
 */
if (!process.env.CONTENTOPS_PRISMA_DATABASE_URL?.trim() && process.env.DIRECT_URL?.trim()) {
  process.env.CONTENTOPS_PRISMA_DATABASE_URL = process.env.DIRECT_URL.trim();
}

async function main() {
  console.log("[smoke] Loading Prisma…");
  const { prisma } = await import("../lib/prisma");
  await prisma.$connect();
  try {
    await prisma.post.count();
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2021") {
      console.error('[smoke] Prisma tables are missing. Run: npm run prisma:migrate (or npm run prisma:deploy)');
      await prisma.$disconnect();
      process.exit(1);
    }
    console.error(
      "[smoke] Database check failed. If this is a pooler/prepared-statement issue, set CONTENTOPS_PRISMA_DATABASE_URL to your direct Postgres URL (same as DIRECT_URL).",
    );
    throw e;
  }
  console.log("[smoke] Database connection and schema OK");

  const hasDrive = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) && Boolean(process.env.DRIVE_INCOMING_FOLDER_ID?.trim());

  if (hasDrive) {
    try {
      const { listIncomingFiles } = await import("../lib/google-drive");
      const files = await listIncomingFiles(5);
      console.log(`[smoke] Drive listIncomingFiles OK (${files.length} sample rows)`);
    } catch (e) {
      console.warn("[smoke] Drive list skipped/failed:", (e as Error).message);
    }
  } else {
    console.log("[smoke] Skipping Drive list (GOOGLE_SERVICE_ACCOUNT_JSON or DRIVE_INCOMING_FOLDER_ID missing)");
  }

  const base = process.env.CONTENTOPS_BASE_URL?.replace(/\/$/, "");
  const pass = process.env.CONTENTOPS_PASSCODE;
  if (base && pass) {
    try {
      const url = `${base}/api/contentops/incoming`;
      const res = await fetch(url, { headers: { "x-contentops-passcode": pass } });
      const text = await res.text();
      if (!res.ok) {
        console.warn("[smoke] GET /api/contentops/incoming via CONTENTOPS_BASE_URL failed:", res.status, text.slice(0, 200));
      } else {
        console.log("[smoke] GET /api/contentops/incoming via CONTENTOPS_BASE_URL OK");
      }
    } catch (e) {
      console.warn("[smoke] Incoming HTTP check skipped (is the dev server running?):", (e as Error).message);
    }
  } else {
    console.log("[smoke] Skipping HTTP incoming check (CONTENTOPS_BASE_URL or CONTENTOPS_PASSCODE missing)");
  }

  if (process.env.CONTENTOPS_TEST_MODE === "true") {
    const { processNewContentOpsPost } = await import("../lib/contentops-post-processor");
    const { postId } = await processNewContentOpsPost({
      machineFamily: "Balers",
      machineModel: "RHB-5T",
      topic: "SMOKE",
      location: null,
      platforms: ["FB", "WEBSITE"],
      driveFileIds: ["smoke-drive-file-1"],
    });
    console.log("[smoke] TEST_MODE post created:", postId);
  } else {
    console.log("[smoke] Skipping TEST_MODE post (set CONTENTOPS_TEST_MODE=true to run)");
  }

  await prisma.$disconnect();
  console.log("[smoke] Done");
}

main().catch((e) => {
  console.error("[smoke] Failed:", e);
  process.exit(1);
});