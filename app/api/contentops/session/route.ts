import { NextResponse } from "next/server";
import { verifySessionCookieValue, CONTENTOPS_SESSION_COOKIE } from "@/lib/contentops-auth";
import { cookies } from "next/headers";

export async function GET() {
  const store = await cookies();
  const ok = verifySessionCookieValue(store.get(CONTENTOPS_SESSION_COOKIE)?.value);
  return NextResponse.json({ ok });
}
