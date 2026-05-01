import { NextResponse } from "next/server";
import { z } from "zod";
import { assertContentOpsRequest } from "@/lib/contentops-auth";
import { processNewContentOpsPost } from "@/lib/contentops-post-processor";

const Body = z.object({
  machineFamily: z.string().min(1),
  machineModel: z.string().optional().nullable(),
  topic: z.string().min(1),
  location: z.string().optional().nullable(),
  platforms: z.array(z.string()).min(1),
  driveFileIds: z.array(z.string()).min(1),
});

export async function POST(request: Request) {
  try {
    await assertContentOpsRequest(request);
  } catch (e) {
    const code = (e as Error & { statusCode?: number }).statusCode;
    if (code === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { postId, sheetSyncFailed } = await processNewContentOpsPost(parsed.data);
    return NextResponse.json({ postId, sheetSyncFailed: !!sheetSyncFailed });
  } catch (e) {
    console.error("[contentops] POST /posts failed:", e);
    return NextResponse.json({ error: (e as Error).message ?? "Processing failed" }, { status: 502 });
  }
}