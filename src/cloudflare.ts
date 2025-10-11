import { startChat } from "./worker/chat";
import { startCFWebSocket } from "./worker/websocket";
import { useCloudflareKV } from "./wrapper/kv";
import type { KVNamespace } from "@cloudflare/workers-types";

interface Env {
  API_KEY_KV?: KVNamespace | undefined;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const resp = startCFWebSocket(request, ctx);

    if (resp === null) {
      return startChat(request, useCloudflareKV(env.API_KEY_KV));
    }

    return resp;
  }
};
