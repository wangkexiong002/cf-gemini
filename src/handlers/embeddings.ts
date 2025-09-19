import { BASE_URL, API_VERSION } from "../config/constants";
import { makeHeaders } from "../utils/helpers";
import { fixCors } from "../utils/cors";
import { HttpError } from "../utils/errors";
import { transformModelForEmbeddings, transformInputForEmbeddings } from "../utils/transformers";

interface EmbeddingRequest {
  model: string;
  input: string | string[];
  dimensions?: number;
}

interface EmbeddingResponse {
  values: number[];
}

export async function handleEmbeddings (req: EmbeddingRequest, apiKey: string | undefined): Promise<Response> {
  const model = transformModelForEmbeddings(req.model);
  const input = transformInputForEmbeddings(req.input);

  const response = await fetch(`${BASE_URL}/${API_VERSION}/${model}:batchEmbedContents`, {
    method: "POST",
    headers: makeHeaders(apiKey, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      "requests": input.map(text => ({
        model,
        content: { parts: { text } },
        outputDimensionality: req.dimensions,
      }))
    })
  });
  let body: string | ReadableStream<any> | null = response.body;
  if (response.ok) {
    const { embeddings } = JSON.parse(await response.text()) as { embeddings: EmbeddingResponse[] };
    body = JSON.stringify({
      object: "list",
      data: embeddings.map(({ values }, index) => ({
        object: "embedding",
        index,
        embedding: values,
      })),
      model: req.model,
    }, null, "  ");
  }
  return new Response(body, fixCors(response));
}
