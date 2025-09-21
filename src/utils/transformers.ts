import { HttpError } from "./errors";
import { parseImg } from "./helpers";
import { generateId } from "./helpers";
import { fieldsMap, harmCategory, reasonsMap, DEFAULT_MODEL, DEFAULT_EMBEDDINGS_MODEL } from "../config/constants";

interface SafetySetting {
  category: string;
  threshold: string;
}

interface FunctionCall {
  id?: string;
  name: string;
  args: any;
}

interface FunctionResponse {
  id?: string;
  name: string;
  response: any;
}

interface Part {
  text?: string;
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface Content {
  role: string;
  parts: Part[];
}

interface Message {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string }; input_audio?: { format: string; data: string } }>;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

interface ChatCompletionRequest {
  model?: string;
  messages: Message[];
  stream?: boolean;
  stream_options?: {
    include_usage?: boolean;
  };
  tools?: any[];
  tool_choice?: any;
  response_format?: any;
  [key: string]: any;
}

interface Candidate {
  index?: number;
  content?: {
    parts: Part[];
  };
  finishReason?: string;
}

interface UsageMetadata {
  candidatesTokenCount?: number;
  promptTokenCount?: number;
  totalTokenCount?: number;
}

interface PromptFeedback {
  blockReason?: string;
  safetyRatings?: Array<{
    blocked: boolean;
  }>;
}

export const safetySettings: SafetySetting[] = harmCategory.map(category => ({
  category,
  threshold: "BLOCK_NONE",
}));

export const adjustProps = (schemaPart: any): void => {
  if (typeof schemaPart !== "object" || schemaPart === null) {
    return;
  }
  if (Array.isArray(schemaPart)) {
    schemaPart.forEach(adjustProps);
  } else {
    if (schemaPart.type === "object" && schemaPart.properties && schemaPart.additionalProperties === false) {
      delete schemaPart.additionalProperties;
    }
    Object.values(schemaPart).forEach(adjustProps);
  }
};

export const adjustSchema = (schema: any): void => {
  const obj = schema[schema.type];
  delete obj.strict;
  return adjustProps(schema);
};

export const transformConfig = (req: ChatCompletionRequest) => {
  let cfg: any = {};
  for (let key in req) {
    const matchedKey = fieldsMap[key as keyof typeof fieldsMap];
    if (matchedKey) {
      cfg[matchedKey] = req[key];
    }
  }
  if (req.response_format) {
    switch (req.response_format.type) {
      case "json_schema":
        adjustSchema(req.response_format);
        cfg.responseSchema = req.response_format.json_schema?.schema;
        if (cfg.responseSchema && "enum" in cfg.responseSchema) {
          cfg.responseMimeType = "text/x.enum";
          break;
        }
        // eslint-disable-next-line no-fallthrough
      case "json_object":
        cfg.responseMimeType = "application/json";
        break;
      case "text":
        cfg.responseMimeType = "text/plain";
        break;
      default:
        throw new HttpError("Unsupported response_format.type", 400);
    }
  }
  return cfg;
};

export const transformFnResponse = ({ content, tool_call_id }: { content: string, tool_call_id: string }, parts: any) => {
  if (!parts.calls) {
    throw new HttpError("No function calls found in the previous message", 400);
  }
  let response;
  try {
    response = JSON.parse(content);
  } catch (err) {
    throw new HttpError("Invalid function response: " + content, 400);
  }
  if (typeof response !== "object" || response === null || Array.isArray(response)) {
    response = { result: response };
  }
  if (!tool_call_id) {
    throw new HttpError("tool_call_id not specified", 400);
  }
  const { i, name } = parts.calls[tool_call_id] ?? {};
  if (!name) {
    throw new HttpError("Unknown tool_call_id: " + tool_call_id, 400);
  }
  if (parts[i]) {
    throw new HttpError("Duplicated tool_call_id: " + tool_call_id, 400);
  }
  parts[i] = {
    functionResponse: {
      id: tool_call_id.startsWith("call_") ? null : tool_call_id,
      name,
      response,
    }
  };
};

export const transformFnCalls = ({ tool_calls }: { tool_calls: any[] }) => {
  const calls: any = {};
  const parts = tool_calls.map(({ function: { arguments: argstr, name }, id, type }: any, i: number) => {
    if (type !== "function") {
      throw new HttpError(`Unsupported tool_call type: "${type}"`, 400);
    }
    let args;
    try {
      args = JSON.parse(argstr);
    } catch (err) {
      throw new HttpError("Invalid function arguments: " + argstr, 400);
    }
    calls[id] = {i, name};
    return {
      functionCall: {
        id: id.startsWith("call_") ? null : id,
        name,
        args,
      }
    };
  });
  (parts as any).calls = calls;
  return parts;
};

export const transformMsg = async ({ content }: { content: any }) => {
  const parts = [];
  if (!Array.isArray(content)) {
    // system, user: string
    // assistant: string or null (Required unless tool_calls is specified.)
    parts.push({ text: content });
    return parts;
  }
  // user:
  // An array of content parts with a defined type.
  // Supported options differ based on the model being used to generate the response.
  // Can contain text, image, or audio inputs.
  for (const item of content) {
    switch (item.type) {
      case "text":
        parts.push({ text: item.text });
        break;
      case "image_url":
        parts.push(await parseImg(item.image_url.url));
        break;
      case "input_audio":
        parts.push({
          inlineData: {
            mimeType: "audio/" + item.input_audio.format,
            data: item.input_audio.data,
          }
        });
        break;
      default:
        throw new HttpError(`Unknown "content" item type: "${item.type}"`, 400);
    }
  }
  if (content.every(item => item.type === "image_url")) {
    parts.push({ text: "" }); // to avoid "Unable to submit request because it must have a text parameter"
  }
  return parts;
};

export const transformMessages = async (messages: Message[]) => {
  if (!messages) { return; }
  const contents = [];
  let system_instruction;
  for (const item of messages) {
    switch (item.role) {
      case "system":
        system_instruction = { parts: await transformMsg(item) };
        continue;
      case "tool":
        // eslint-disable-next-line no-case-declarations
        let { role, parts } = contents[contents.length - 1] ?? {} as any;
        if (role !== "function") {
          const calls = parts?.calls;
          parts = [];
          (parts as any).calls = calls;
          contents.push({
            role: "function", // ignored
            parts
          });
        }
        transformFnResponse(item as any, parts);
        continue;
      case "assistant":
        item.role = "model";
        break;
      case "user":
        break;
      default:
        throw new HttpError(`Unknown message role: "${item.role}"`, 400);
    }
    contents.push({
      role: item.role,
      parts: item.tool_calls ? transformFnCalls(item as any) : await transformMsg(item)
    });
  }
  if (system_instruction) {
    if (!contents[0]?.parts.some(part => part.text)) {
      contents.unshift({ role: "user", parts: { text: " " } as any });
    }
  }
  return { system_instruction, contents };
};

export const transformTools = (req: ChatCompletionRequest) => {
  let tools, tool_config;
  if (req.tools) {
    const funcs = req.tools.filter(tool => tool.type === "function");
    funcs.forEach(adjustSchema);
    tools = [{ function_declarations: funcs.map(schema => schema.function) }];
  }
  if (req.tool_choice) {
    const allowed_function_names = req.tool_choice?.type === "function" ? [ req.tool_choice?.function?.name ] : undefined;
    if (allowed_function_names || typeof req.tool_choice === "string") {
      tool_config = {
        function_calling_config: {
          mode: allowed_function_names ? "ANY" : req.tool_choice.toUpperCase(),
          allowed_function_names
        }
      };
    }
  }
  return { tools, tool_config };
};

export const transformRequest = async (req: ChatCompletionRequest) => ({
  ...await transformMessages(req.messages),
  safetySettings,
  generationConfig: transformConfig(req),
  ...transformTools(req),
});

export const transformCandidates = (key: string, cand: Candidate) => {
  const message: any = { role: "assistant", content: [] };
  for (const part of cand.content?.parts ?? []) {
    if (part.functionCall) {
      const fc = part.functionCall;
      message.tool_calls = message.tool_calls ?? [];
      message.tool_calls.push({
        id: fc.id ?? "call_" + generateId(),
        type: "function",
        function: {
          name: fc.name,
          arguments: JSON.stringify(fc.args),
        }
      });
    } else {
      message.content.push(part.text);
    }
  }
  message.content = message.content.join("\n\n|>") || null;
  return {
    index: cand.index || 0, // 0-index is absent in new -002 models response
    [key]: message,
    logprobs: null,
    finish_reason: message.tool_calls ? "tool_calls" : reasonsMap[cand.finishReason as keyof typeof reasonsMap] || cand.finishReason,
  };
};

export const transformCandidatesMessage = transformCandidates.bind(null, "message");
export const transformCandidatesDelta = transformCandidates.bind(null, "delta");

export const transformUsage = (data: UsageMetadata) => ({
  completion_tokens: data.candidatesTokenCount,
  prompt_tokens: data.promptTokenCount,
  total_tokens: data.totalTokenCount
});

export const checkPromptBlock = (choices: any[], promptFeedback: PromptFeedback, key: string) => {
  if (choices.length) { return; }
  if (promptFeedback?.blockReason) {
    if (promptFeedback.blockReason === "SAFETY") {
      promptFeedback.safetyRatings
        ?.filter(r => r.blocked)
    }
    choices.push({
      index: 0,
      [key]: null,
      finish_reason: "content_filter",
    });
  }
  return true;
};

export const processCompletionsResponse = (data: any, model: string, id: string) => {
  const obj = {
    id,
    choices: data.candidates.map(transformCandidatesMessage),
    created: Math.floor(Date.now()/1000),
    model: data.modelVersion ?? model,
    object: "chat.completion",
    usage: data.usageMetadata && transformUsage(data.usageMetadata),
  };
  if (obj.choices.length === 0 ) {
    checkPromptBlock(obj.choices, data.promptFeedback, "message");
  }
  return JSON.stringify(obj);
};

export const transformModelForEmbeddings = (model: string) => {
  if (typeof model !== "string") {
    throw new HttpError("model is not specified", 400);
  }
  let modelName;
  if (model.startsWith("models/")) {
    modelName = model;
  } else {
    if (!model.startsWith("gemini-")) {
      model = DEFAULT_EMBEDDINGS_MODEL;
    }
    modelName = "models/" + model;
  }
  return modelName;
};

export const transformInputForEmbeddings = (input: string | string[]) => {
  if (!Array.isArray(input)) {
    return [input];
  }
  return input;
};
