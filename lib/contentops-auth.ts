import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "contentops_session";

function timingSafeStringEq(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function signPayload(payload: string): string {
  const secret = process.env.CONTENTOPS_PASSCODE ?? "";
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function mintSessionCookieValue(): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 14;
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url");
  const sig = signPayload(payload);
  return `${payload}.${sig}`;
}

export function verifySessionCookieValue(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = signPayload(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof json.exp === "number" && json.exp > Date.now();
  } catch {
    return false;
  }
}

export async function assertContentOpsRequest(request: Request): Promise<void> {
  const envPass = process.env.CONTENTOPS_PASSCODE;
  if (!envPass) {
    throw new Error("CONTENTOPS_PASSCODE is not configured");
  }
  const headerPass = request.headers.get("x-contentops-passcode");
  if (headerPass && timingSafeStringEq(headerPass, envPass)) {
    return;
  }
  const store = await cookies();
  const c = store.get(COOKIE)?.value;
  if (verifySessionCookieValue(c)) return;
  const err = new Error("UNAUTHORIZED");
  (err as Error & { statusCode: number }).statusCode = 401;
  throw err;
}

export function verifyContentOpsPasscode(attempt: string | undefined): boolean {
  const envPass = process.env.CONTENTOPS_PASSCODE;
  if (!attempt || !envPass) return false;
  return timingSafeStringEq(attempt, envPass);
}

export const requireContentOpsAuth = assertContentOpsRequest;

export { COOKIE as CONTENTOPS_SESSION_COOKIE };
