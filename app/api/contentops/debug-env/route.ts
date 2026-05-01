import { NextResponse } from "next/server";

const DEBUG_ENV_KEYS = ["DATABASE_URL", "DIRECT_URL", "CONTENTOPS_PRISMA_DATABASE_URL"] as const;

function envSummary(key: (typeof DEBUG_ENV_KEYS)[number]) {
  const value = process.env[key]?.trim();
  return {
    key,
    present: !!value,
    prefix: value?.slice(0, 12) ?? "",
    length: value?.length ?? 0,
  };
}

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json(DEBUG_ENV_KEYS.map(envSummary));
}
