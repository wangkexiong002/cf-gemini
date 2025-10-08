import type { KVNamespace } from "@cloudflare/workers-types";
import type { VercelKV } from "@vercel/kv";

export interface UniversalKV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

const isCloudflare =
  typeof globalThis !== "undefined" &&
  typeof (globalThis as any).caches !== "undefined" &&
  typeof (globalThis as any).process === "undefined";

const isVercel =
  typeof (globalThis as any).EdgeRuntime !== "undefined" ||
  (typeof process !== "undefined" && process?.env?.VERCEL === "1");

function createCloudflareKV(env: Record<string, any>): UniversalKV {
  const kvBinding =
    env.API_KEY_KV ||
    Object.values(env).find((v) => v && typeof v.get === "function");

  if (!kvBinding) throw new Error("[UniversalKV] Cloudflare KV binding not found");

  const cfKV = kvBinding as KVNamespace;

  return {
    async get(key) {
      return await cfKV.get(key); // string | null
    },
    async set(key, value, opts) {
      await cfKV.put(key, value, opts);
    },
    async delete(key) {
      await cfKV.delete(key);
    },
  };
}

function createVercelKV(vercelKV: VercelKV): UniversalKV {
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

function createLocalKV(): UniversalKV {
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

// ✅ 自动检测运行环境并实例化
let kv: UniversalKV;

if (isCloudflare) {
  kv = createCloudflareKV((globalThis as any).ENV || globalThis);
} else if (isVercel) {
  const { kv: vercelKV } = await import("@vercel/kv");
  kv = createVercelKV(vercelKV);
} else {
  kv = createLocalKV();
}

export { kv };