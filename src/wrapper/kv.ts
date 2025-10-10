import type { KVNamespace } from "@cloudflare/workers-types";
import type { VercelKV } from "@vercel/kv";

export interface UniversalKV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export function useCloudflareKV(kv: KVNamespace<string> | undefined): UniversalKV {
  const invalidKV = !kv || typeof kv.get !== "function";
  if (invalidKV) { throw new Error("[UniversalKV] Cloudflare KV binding not found"); }

  return {
    async get(key) {
      return await kv.get(key); // string | null
    },
    async set(key, value, opts) {
      await kv.put(key, value, opts);
    },
    async delete(key) {
      await kv.delete(key);
    },
  };
}

export function useVercelKV(vercelKV: VercelKV): UniversalKV {
  return {
    async get(key) {
      const val = await vercelKV.get<string>(key);
      return val ?? null;
    },
    async set(key, value) {
      await vercelKV.set(key, value);
    },
    async delete(key) {
      await vercelKV.del(key);
    },
  };
}

export function useLocalKV(): UniversalKV {
  const store = new Map<string, string>();
  console.warn("[UniversalKV] Using in-memory KV for local dev");

  return {
    async get(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    async set(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}