import { handleOPTIONS } from "../handlers/options";
import { handleModels } from "../handlers/models";
import { handleEmbeddings } from "../handlers/embeddings";
import { handleCompletions } from "../handlers/completions";
import { HttpError } from "../utils/errors";
import { ApiKeyManager } from "../utils/apiKeyManager";
import { UniversalKV } from "../wrapper/kv";

export async function startChat(request: Request, kv: UniversalKV): Promise<Response> {
  if (request.method === "OPTIONS") {
    return handleOPTIONS();
  }

  const errHandler = (err: Error & { status?: number }): Response => {
    return new Response(err.message, {
      status: err.status ?? 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      }
    });
  };

  try {
    const auth = request.headers.get("Authorization");
    const apiKeyFromHeader = auth?.split(" ")[1];
    const apiKeyManager = new ApiKeyManager(apiKeyFromHeader, kv);

    const assert = (success: boolean): void => {
      if (!success) {
        throw new HttpError("The specified HTTP method is not allowed for the requested resource", 400);
      }
    };

    const { pathname } = new URL(request.url);

    switch (true) {
      case pathname.endsWith("/chat/completions"):
        assert(request.method === "POST");
        return handleCompletions(await request.json(), apiKeyManager)
          .catch(errHandler);
      case pathname.endsWith("/embeddings"):
        assert(request.method === "POST");
        return handleEmbeddings(await request.json(), apiKeyManager)
          .catch(errHandler);
      case pathname.endsWith("/models"):
        assert(request.method === "GET");
        return handleModels(apiKeyManager)
          .catch(errHandler);
      default:
        throw new HttpError("404 Not Found", 404);
    }
  } catch (err: any) {
    return errHandler(err);
  }
};
