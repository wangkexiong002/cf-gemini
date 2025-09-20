import { generateId } from "./helpers";

const responseLineRE = /^data: (.*)(?:\n\n|\r\r|\r\n\r\n)/;
const delimiter = "\n\n";
const sseline = (obj: any): string => {
  obj.created = Math.floor(Date.now()/1000);
  return "data: " + JSON.stringify(obj) + delimiter;
};

export function parseStream(chunk: string, controller: any, context: any): void {
  context.buffer += chunk;
  do {
    const match = context.buffer.match(responseLineRE);
    if (!match) { break; }
    controller.enqueue(match[1]);
    context.buffer = context.buffer.substring(match[0].length);
  } while (true); // eslint-disable-line no-constant-condition
}

export function parseStreamFlush(controller: any, context: any): void {
  if (context.buffer) {
    console.error("Invalid data:", context.buffer);
    controller.enqueue(context.buffer);
    context.shared.is_buffers_rest = true;
  }
}

export function toOpenAiStream(line: string, controller: any, context: any): void {
  let data: any;
  try {
    data = JSON.parse(line);
    if (!data.candidates) {
      throw new Error("Invalid completion chunk object");
    }
  } catch (err: any) {
    console.error("Error parsing response:", err);
    if (!context.shared.is_buffers_rest) { line += delimiter; }
    controller.enqueue(line); // output as is
    return;
  }
  const obj: any = {
    id: context.id,
    choices: data.candidates.map(context.transformCandidatesDelta),
    model: data.modelVersion ?? context.model,
    object: "chat.completion.chunk",
    usage: data.usageMetadata && context.streamIncludeUsage ? null : undefined,
  };
  if (context.checkPromptBlock(obj.choices, data.promptFeedback, "delta")) {
    controller.enqueue(sseline(obj));
    return;
  }
  console.assert(data.candidates.length === 1, "Unexpected candidates count: %d", data.candidates.length);
  const cand: any = obj.choices[0];
  cand.index = cand.index || 0; // absent in new -002 models response
  const finish_reason = cand.finish_reason;
  cand.finish_reason = null;
  if (!context.last[cand.index]) { // first
    controller.enqueue(sseline({
      ...obj,
      choices: [{ ...cand, tool_calls: undefined, delta: { role: "assistant", content: "" } }],
    }));
  }
  delete cand.delta.role;
  if ("content" in cand.delta) { // prevent empty data (e.g. when MAX_TOKENS)
    controller.enqueue(sseline(obj));
  }
  cand.finish_reason = finish_reason;
  if (data.usageMetadata && context.streamIncludeUsage) {
    obj.usage = context.transformUsage(data.usageMetadata);
  }
  cand.delta = {};
  context.last[cand.index] = obj;
}

export function toOpenAiStreamFlush(controller: any, context: any): void {
  if (context.last.length > 0) {
    for (const obj of context.last) {
      controller.enqueue(sseline(obj));
    }
    controller.enqueue("data: [DONE]" + delimiter);
  }
}
