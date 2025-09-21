import { BASE_URL, API_VERSION, DEFAULT_MODEL } from "../config/constants";
import { makeHeaders, generateId } from "../utils/helpers";
import { fixCors } from "../utils/cors";
import {
  transformRequest,
  transformCandidatesDelta,
  transformUsage,
  checkPromptBlock,
  processCompletionsResponse
} from "../utils/transformers";
import {
  parseStream,
  parseStreamFlush,
  toOpenAiStream,
  toOpenAiStreamFlush
} from "../utils/stream";
import { ApiKeyManager } from "../utils/apiKeyManager";
import { HttpError } from "../utils/errors";
import { fetchWithRetry } from "../utils/fetchWithRetry";

interface ChatCompletionRequest {
  model?: string;
  messages: any[];
  stream?: boolean;
  stream_options?: {
    include_usage?: boolean;
  };
  [key: string]: any;
}

export async function handleCompletions(req: ChatCompletionRequest, apiKeyManager: ApiKeyManager): Promise<Response> {
  let model = DEFAULT_MODEL;
  const modelStr = req.model || "";
  switch (true) {
    case typeof req.model !== "string":
      break;
    case modelStr.startsWith("models/"):
      model = modelStr.substring(7);
      break;
    case modelStr.startsWith("gemini-"):
    case modelStr.startsWith("gemma-"):
    case modelStr.startsWith("learnlm-"):
      model = modelStr;
  }
  let body = await transformRequest(req);
  switch (true) {
    case model.endsWith(":search"):
      model = model.substring(0, model.length - 7);
      // eslint-disable-next-line no-fallthrough
    case req.model?.endsWith("-search-preview"):
      body.tools = body.tools || [];
      (body.tools as any[]).push({googleSearch: {}});
  }
  const TASK = req.stream ? "streamGenerateContent" : "generateContent";
  let url = `${BASE_URL}/${API_VERSION}/models/${model}:${TASK}`;
  if (req.stream) {
    url += "?alt=sse";
  }

  const response = await fetchWithRetry(apiKeyManager, url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let responseBody: BodyInit | null = response.body;
  if (response.ok) {
    let id = "chatcmpl-" + generateId(); //"chatcmpl-8pMMaqXMK68B3nyDBrapTDrhkHBQK";
    const shared = {};
    if (req.stream) {
      if (!response.body) {
        return new Response(null, { status: 204 });
      }
      const streamParseInfo = { buffer: "", shared };
      const streamOpenAiInfo = {
        streamIncludeUsage: req.stream_options?.include_usage,
        model,
        id,
        last: [],
        shared,
        transformCandidatesDelta,
        checkPromptBlock,
        transformUsage
      };
      responseBody = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TransformStream({
          transform: (chunk, controller) => parseStream(chunk, controller, streamParseInfo),
          flush: (controller) => parseStreamFlush(controller, streamParseInfo),
        }))
        .pipeThrough(new TransformStream({
          transform: (chunk, controller) => toOpenAiStream(chunk, controller, streamOpenAiInfo),
          flush: (controller) => toOpenAiStreamFlush(controller, streamOpenAiInfo),
        }))
        .pipeThrough(new TextEncoderStream());
    } else {
      const responseText = await response.text();
      try {
        let parsedJson = JSON.parse(responseText);
        if (!parsedJson.candidates) {
          throw new Error("Invalid completion object");
        }
        responseBody = JSON.stringify(processCompletionsResponse(parsedJson, model, id));
      } catch (err) {
        return new Response(responseText, fixCors(response)); // output as is
      }
    }
  }
  return new Response(responseBody, fixCors(response));
}
