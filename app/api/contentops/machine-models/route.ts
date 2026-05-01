import { NextResponse } from "next/server";
import { assertContentOpsRequest } from "@/lib/contentops-auth";
import { DEFAULT_MACHINE_MODELS, normalizeContentOpsMachineFamily } from "@/lib/contentops-constants";
import { ensureDefaultMachineModelsSeeded } from "@/lib/contentops-machine-models";
import { prisma } from "@/lib/prisma";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" } as const;

function developmentErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.startsWith("DB_URL_INVALID:")) return message;
  return message;
}

export async function GET(request: Request) {
  try {
    await assertContentOpsRequest(request);
  } catch (e) {
    const code = (e as Error & { statusCode?: number }).statusCode;
    if (code === 401) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const body: { ok: false; error: "server_error"; message?: string } = { ok: false, error: "server_error" };
    if (process.env.NODE_ENV === "development") {
      body.message = developmentErrorMessage(e);
    }
    return NextResponse.json(body, { status: 500 });
  }

  const url = new URL(request.url);
  const familyParam =
    url.searchParams.get("family")?.trim() ?? url.searchParams.get("machineFamily")?.trim() ?? "";

  try {
    await ensureDefaultMachineModelsSeeded();

    if (!familyParam) {
      return NextResponse.json(
        { ok: true, machineFamily: "", models: [] as string[] },
        { headers: noStoreHeaders },
      );
    }

    const canonicalFamily = normalizeContentOpsMachineFamily(familyParam);

    const rows = await prisma.machineModelOption.findMany({
      where: { family: canonicalFamily, isActive: true },
      orderBy: { model: "asc" },
      select: { model: true },
    });

    const fromDb = rows.map((r: { model: string }) => r.model);
    const defaults = DEFAULT_MACHINE_MODELS[canonicalFamily];
    const models =
      fromDb.length > 0
        ? fromDb
        : defaults != null && defaults.length > 0
          ? defaults.slice().sort((a, b) => a.localeCompare(b))
          : [];

    return NextResponse.json(
      {
        ok: true,
        machineFamily: canonicalFamily,
        models,
      },
      { headers: noStoreHeaders },
    );
  } catch (err) {
    console.error("[contentops] GET /machine-models failed:", err);
    const body: { ok: false; error: "server_error"; message?: string } = { ok: false, error: "server_error" };
    if (process.env.NODE_ENV === "development") {
      body.message = developmentErrorMessage(err);
    }
    return NextResponse.json(body, { status: 500 });
  }
}
