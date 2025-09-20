import { BASE_URL, API_VERSION } from "../config/constants";
import { makeHeaders } from "../utils/helpers";
import { fixCors } from "../utils/cors";
import { ApiKeyManager } from "../utils/apiKeyManager";
import { HttpError } from "../utils/errors";
import { fetchWithRetry } from "../utils/fetchWithRetry";

interface Model {
  name: string;
}

export async function handleModels(apiKeyManager: ApiKeyManager): Promise<Response> {
  console.log("handleModels: Starting models request");
  const url = `${BASE_URL}/${API_VERSION}/models`;
  console.log(`handleModels: Request URL: ${url}`);

  console.log("handleModels: Calling fetchWithRetry");
  const response = await fetchWithRetry(apiKeyManager, url, {
    method: "GET",
  });
  console.log(`handleModels: fetchWithRetry completed with status: ${response.status}`);

  let body: string | ReadableStream<any> | null = response.body;
  if (response.ok) {
    const responseText = await response.text();
    console.log(`handleModels: Response text: ${responseText}`);
    const { models } = JSON.parse(responseText) as { models: Model[] };
    body = JSON.stringify({
      object: "list",
      data: models.map(({ name }) => ({
        id: name.replace("models/", ""),
        object: "model",
        created: 0,
        owned_by: "",
      })),
    }, null, "  ");
  }
  console.log("handleModels: Request completed");
  return new Response(body, fixCors(response));
}
