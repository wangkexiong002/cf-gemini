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
  console.log("handleCompletions: Starting completion request");
  let model = DEFAULT_MODEL;
  const modelStr = req.model || "";
  console.log(`handleCompletions: Requested model: ${modelStr}`);
  switch (true) {
    case typeof req.model !== "string":
      console.log("handleCompletions: Model is not a string, using default model");
      break;
    case modelStr.startsWith("models/"):
      model = modelStr.substring(7);
      console.log(`handleCompletions: Model starts with 'models/', using: ${model}`);
      break;
    case modelStr.startsWith("gemini-"):
    case modelStr.startsWith("gemma-"):
    case modelStr.startsWith("learnlm-"):
      model = modelStr;
      console.log(`handleCompletions: Using specified model: ${model}`);
  }
  let body = await transformRequest(req);
  console.log("handleCompletions: Request body transformed");
  switch (true) {
    case model.endsWith(":search"):
      model = model.substring(0, model.length - 7);
      console.log(`handleCompletions: Model ends with ':search', using: ${model}`);
      // eslint-disable-next-line no-fallthrough
    case req.model.endsWith("-search-preview"):
      body.tools = body.tools || [];
      body.tools.push({googleSearch: {}});
      console.log("handleCompletions: Added Google Search tool to request");
  }
  const TASK = req.stream ? "streamGenerateContent" : "generateContent";
  console.log(`handleCompletions: Task determined as: ${TASK}`);
  let url = `${BASE_URL}/${API_VERSION}/models/${model}:${TASK}`;
  if (req.stream) {
    url += "?alt=sse";
    console.log("handleCompletions: Streaming enabled, added ?alt=sse to URL");
  }
  console.log(`handleCompletions: Final URL: ${url}`);

  console.log("handleCompletions: Calling fetchWithRetry");
  const response = await fetchWithRetry(apiKeyManager, url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log(`handleCompletions: fetchWithRetry completed with status: ${response.status}`);

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
        console.error("Error parsing response:", err);
        return new Response(responseText, fixCors(response)); // output as is
      }
    }
  }
  return new Response(responseBody, fixCors(response));
}
