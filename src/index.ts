import { handleOPTIONS } from "./utils/cors";
import { handleModels } from "./handlers/models";
import { handleEmbeddings } from "./handlers/embeddings";
import { handleCompletions } from "./handlers/completions";
import { HttpError } from "./utils/errors";
import { ApiKeyManager } from "./utils/apiKeyManager";

export interface Env {
  API_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    console.log(`Index: Received ${request.method} request to ${request.url}`);
    if (request.method === "OPTIONS") {
      console.log("Index: Handling OPTIONS request");
      return handleOPTIONS();
    }

    const errHandler = (err: Error & { status?: number }): Response => {
      console.error("Index: Error occurred:", err);
      return new Response(err.message, {
        status: err.status ?? 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        }
      });
    };

    try {
      console.log("Index: Processing request");
      const auth = request.headers.get("Authorization");
      console.log(`Index: Authorization header: ${auth ? 'Present' : 'Not present'}`);
      const apiKeyFromHeader = auth?.split(" ")[1];
      console.log(`Index: API key from header: ${apiKeyFromHeader ? 'Present' : 'Not present'}`);
      const apiKeyManager = new ApiKeyManager(apiKeyFromHeader ?? env.API_KEY);
      console.log(`Index: API key manager created with ${apiKeyManager.getTotalKeys()} keys`);

      const assert = (success: boolean): void => {
        if (!success) {
          console.error("Index: Assertion failed");
          throw new HttpError("The specified HTTP method is not allowed for the requested resource", 400);
        }
      };

      const { pathname } = new URL(request.url);
      console.log(`Index: Request pathname: ${pathname}`);

      switch (true) {
        case pathname.endsWith("/chat/completions"):
          console.log("Index: Handling chat completions request");
          assert(request.method === "POST");
          console.log("Index: Calling handleCompletions");
          return handleCompletions(await request.json(), apiKeyManager)
            .catch(errHandler);
        case pathname.endsWith("/embeddings"):
          console.log("Index: Handling embeddings request");
          assert(request.method === "POST");
          console.log("Index: Calling handleEmbeddings");
          return handleEmbeddings(await request.json(), apiKeyManager)
            .catch(errHandler);
        case pathname.endsWith("/models"):
          console.log("Index: Handling models request");
          assert(request.method === "GET");
          console.log("Index: Calling handleModels");
          return handleModels(apiKeyManager)
            .catch(errHandler);
        default:
          console.error("Index: Unhandled route");
          throw new HttpError("404 Not Found", 404);
      }
    } catch (err: any) {
      console.error("Index: Caught error in main handler:", err);
      return errHandler(err);
    }
  }
} satisfies ExportedHandler<Env>;
