import { Redis } from "@upstash/redis";

let client: Redis | null | undefined;

/**
 * Optional Upstash Redis. Returns null when env is not configured — callers should not block MVP on this.
 */
export function getOptionalRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    client = null;
    return null;
  }
  client = new Redis({ url, token });
  return client;
}
