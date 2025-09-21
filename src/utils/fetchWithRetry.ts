import { ApiKeyManager } from "./apiKeyManager";
import { HttpError } from "./errors";
import { makeHeaders, maskApiKey } from "./helpers";

export async function fetchWithRetry(
  apiKeyManager: ApiKeyManager,
  url: string,
  options: RequestInit
): Promise<Response> {
  const maxRetries = apiKeyManager.getTotalKeys();
  let attempt = 0;

  while (attempt < maxRetries) {
    const apiKey = apiKeyManager.getAvailableKey();
    if (!apiKey) {
      throw new HttpError("No available API keys", 500);
    }

    // Hide the middle part of the API key for logging
    const maskedApiKey = maskApiKey(apiKey);

    try {
      const headers = {
        ...options.headers,
        ...makeHeaders(apiKey),
      };
      const currentOptions = { ...options, headers };
      const response = await fetch(url, currentOptions);
      console.log(`recevied response ${response.status} from ${url} with ${maskedApiKey}`);

      if (response.status >= 500) {
        apiKeyManager.disableKeyTemporarily(apiKey);
        attempt++;
        continue;
      }

      if (response.status === 429) {
        apiKeyManager.disableKeyForDay(apiKey);
        attempt++;
        continue;
      }

      return response;
    } catch (error) {
      apiKeyManager.disableKeyTemporarily(apiKey);
      attempt++;
    }
  }

  throw new HttpError("All API keys failed", 500);
}
