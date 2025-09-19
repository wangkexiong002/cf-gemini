import { BASE_URL, API_VERSION } from "../config/constants";
import { makeHeaders } from "../utils/helpers";
import { fixCors } from "../utils/cors";

interface Model {
  name: string;
}

export async function handleModels (apiKey: string | undefined): Promise<Response> {
  const response = await fetch(`${BASE_URL}/${API_VERSION}/models`, {
    headers: makeHeaders(apiKey),
  });
  let body: string | ReadableStream<any> | null = response.body;
  if (response.ok) {
    const { models } = JSON.parse(await response.text()) as { models: Model[] };
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
  return new Response(body, fixCors(response));
}
