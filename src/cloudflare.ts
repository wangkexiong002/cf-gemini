import { startWorker } from "./worker/start";
import { useCloudflareKV } from "./wrapper/kv";
import type { KVNamespace } from "@cloudflare/workers-types";

interface Env {
  API_KEY_KV?: KVNamespace | undefined;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return startWorker(request, useCloudflareKV(env.API_KEY_KV));
  }
};
