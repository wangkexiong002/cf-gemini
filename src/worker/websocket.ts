import { WS_BASE_URL } from "../config/constants";

export function startCFWebSocket(request: Request, ctx: ExecutionContext): Response | null {
  if (request.headers.get("Upgrade") !== "websocket") {
    return null;
  }

  const url = new URL(request.url);
  const pathAndQuery = url.pathname + url.search;
  const targetUrl = `${WS_BASE_URL}${pathAndQuery}`;

  const pair = new WebSocketPair();
  const [client, proxy] = [pair[0], pair[1]];
  proxy.accept();

  let pendingMessages: (string | ArrayBuffer | Blob)[] = [];

  const connectPromise = new Promise<void>((resolve) => {
    const targetWebSocket = new WebSocket(targetUrl);

    targetWebSocket.addEventListener("open", () => {
      console.log(`websocket - Processing ${pendingMessages.length} pending messages`);
      for (const message of pendingMessages) {
        try {
          targetWebSocket.send(message);
        } catch (error) {
          console.error("websocket - Error sending pending message:", error);
        }
      }
      pendingMessages = [];
      resolve();
    });

    proxy.addEventListener("message", (event: MessageEvent) => {
      /*
      console.log("websocket - Received message from client:", {
        dataPreview: typeof event.data === "string" ? event.data.slice(0, 200) : "Binary data",
        dataType: typeof event.data,
        timestamp: new Date().toISOString(),
      });
      */

      if (targetWebSocket.readyState === WebSocket.OPEN) {
        try {
          targetWebSocket.send(event.data);
        } catch (error) {
          console.error("websocket - Error sending to gemini:", error);
        }
      } else {
        console.log("websocket - Connection not ready, queueing message");
        pendingMessages.push(event.data);
      }
    });

    targetWebSocket.addEventListener("message", (event: MessageEvent) => {
      /*
      console.log("websocket - Received message from gemini:", {
        dataPreview: typeof event.data === "string" ? event.data.slice(0, 200) : "Binary data",
        dataType: typeof event.data,
        timestamp: new Date().toISOString(),
      });
      */

      try {
        if (proxy.readyState === WebSocket.OPEN) {
          proxy.send(event.data);
        }
      } catch (error) {
        console.error("websocket - Error forwarding to client:", error);
      }
    });

    targetWebSocket.addEventListener("close", (event: CloseEvent) => {
      console.log("websocket - Gemini connection closed:", {
        code: event.code,
        reason: event.reason || "No reason provided",
        wasClean: event.wasClean,
        timestamp: new Date().toISOString(),
        readyState: targetWebSocket.readyState,
      });
      if (proxy.readyState === WebSocket.OPEN) {
        proxy.close(event.code, event.reason);
      }
    });

    proxy.addEventListener("close", (event: CloseEvent) => {
      console.log("websocket - Client connection closed:", {
        code: event.code,
        reason: event.reason || "No reason provided",
        wasClean: event.wasClean,
        timestamp: new Date().toISOString(),
      });
      if (targetWebSocket.readyState === WebSocket.OPEN) {
        targetWebSocket.close(event.code, event.reason);
      }
    });

    targetWebSocket.addEventListener("error", (error: Event) => {
      console.error("websocket - Gemini WebSocket error:", {
        error: (error as ErrorEvent).message || "Unknown error",
        timestamp: new Date().toISOString(),
        readyState: targetWebSocket.readyState,
      });
    });
  });

  ctx.waitUntil(connectPromise);

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}