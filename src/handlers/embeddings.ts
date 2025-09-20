import { BASE_URL, API_VERSION } from "../config/constants";
import { makeHeaders } from "../utils/helpers";
import { fixCors } from "../utils/cors";
import { HttpError } from "../utils/errors";
import { transformModelForEmbeddings, transformInputForEmbeddings } from "../utils/transformers";
import { ApiKeyManager } from "../utils/apiKeyManager";
import { fetchWithRetry } from "../utils/fetchWithRetry";

interface EmbeddingRequest {
  model: string;
  input: string | string[];
  dimensions?: number;
}

interface EmbeddingResponse {
  values: number[];
}

export async function handleEmbeddings(req: EmbeddingRequest, apiKeyManager: ApiKeyManager): Promise<Response> {
  console.log("handleEmbeddings: Starting embedding request");
  console.log(`handleEmbeddings: Request model: ${req.model}`);
  console.log(`handleEmbeddings: Request input: ${JSON.stringify(req.input)}`);
  console.log(`handleEmbeddings: Request dimensions: ${req.dimensions}`);

  const model = transformModelForEmbeddings(req.model);
  console.log(`handleEmbeddings: Transformed model: ${model}`);

  const input = transformInputForEmbeddings(req.input);
  console.log(`handleEmbeddings: Transformed input length: ${input.length}`);

  const url = `${BASE_URL}/${API_VERSION}/${model}:batchEmbedContents`;
  console.log(`handleEmbeddings: Request URL: ${url}`);

  const bodyContent = JSON.stringify({
    "requests": input.map(text => ({
      model,
      content: { parts: { text } },
      outputDimensionality: req.dimensions,
    }))
  });
  console.log(`handleEmbeddings: Request body: ${bodyContent}`);

  console.log("handleEmbeddings: Calling fetchWithRetry");
  const response = await fetchWithRetry(apiKeyManager, url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyContent,
  });
  console.log(`handleEmbeddings: fetchWithRetry completed with status: ${response.status}`);

  let body: string | ReadableStream<any> | null = response.body;
  if (response.ok) {
    const responseText = await response.text();
    console.log(`handleEmbeddings: Response text: ${responseText}`);
    const { embeddings } = JSON.parse(responseText) as { embeddings: EmbeddingResponse[] };
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
  console.log("handleEmbeddings: Request completed");
  return new Response(body, fixCors(response));
}
