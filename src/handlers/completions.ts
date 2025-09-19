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

interface ChatCompletionRequest {
  model?: string;
  messages: any[];
  stream?: boolean;
  stream_options?: {
    include_usage?: boolean;
  };
  [key: string]: any;
}

export async function handleCompletions (req: ChatCompletionRequest, apiKey: string | undefined): Promise<Response> {
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
    case req.model.endsWith("-search-preview"):
      body.tools = body.tools || [];
      body.tools.push({googleSearch: {}});
  }
  const TASK = req.stream ? "streamGenerateContent" : "generateContent";
  let url = `${BASE_URL}/${API_VERSION}/models/${model}:${TASK}`;
  if (req.stream) { url += "?alt=sse"; }
  const response = await fetch(url, {
    method: "POST",
    headers: makeHeaders(apiKey, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

  body = response.body;
  if (response.ok) {
    let id = "chatcmpl-" + generateId(); //"chatcmpl-8pMMaqXMK68B3nyDBrapTDrhkHBQK";
    const shared = {};
    if (req.stream) {
      body = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TransformStream({
          transform: parseStream,
          flush: parseStreamFlush,
          buffer: "",
          shared,
        }))
        .pipeThrough(new TransformStream({
          transform: toOpenAiStream,
          flush: toOpenAiStreamFlush,
          streamIncludeUsage: req.stream_options?.include_usage,
          model, id, last: [],
          shared,
          transformCandidatesDelta,
          checkPromptBlock,
          transformUsage
        }))
        .pipeThrough(new TextEncoderStream());
    } else {
      body = await response.text();
      try {
        body = JSON.parse(body);
        if (!body.candidates) {
          throw new Error("Invalid completion object");
        }
      } catch (err) {
        console.error("Error parsing response:", err);
        return new Response(body, fixCors(response)); // output as is
      }
      body = processCompletionsResponse(body, model, id);
    }
  }
  return new Response(body, fixCors(response));
}
