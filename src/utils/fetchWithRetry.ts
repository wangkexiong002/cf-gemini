import { ApiKeyManager } from "./apiKeyManager";
import { HttpError } from "./errors";
import { makeHeaders, maskApiKey } from "./helpers";

export async function fetchWithRetry(
  apiKeyManager: ApiKeyManager,
  url: string,
  options: RequestInit
): Promise<Response> {
  const maxRetries = apiKeyManager.getTotalKeys();
  console.log(`fetchWithRetry: Starting request to ${url} with max retries: ${maxRetries}`);
  let attempt = 0;

  while (attempt < maxRetries) {
    console.log(`fetchWithRetry: Attempt ${attempt + 1}/${maxRetries}`);
    const apiKey = apiKeyManager.getAvailableKey();
    if (!apiKey) {
      console.error("fetchWithRetry: No available API keys");
      throw new HttpError("No available API keys", 500);
    }

    // Hide the middle part of the API key for logging
    const maskedApiKey = maskApiKey(apiKey);
    console.log(`fetchWithRetry: Using API key: ${maskedApiKey}`);

    try {
      const headers = {
        ...options.headers,
        ...makeHeaders(apiKey),
      };
      const currentOptions = { ...options, headers };
      console.log(`fetchWithRetry: Sending request to ${url} with options: ${JSON.stringify(currentOptions)}`);
      const response = await fetch(url, currentOptions);
      console.log(`fetchWithRetry: Received response with status: ${response.status}`);

      if (response.status >= 500) {
        console.log(`fetchWithRetry: Server error (status ${response.status}), temporarily disabling key: ${maskedApiKey}`);
        apiKeyManager.disableKeyTemporarily(apiKey);
        attempt++;
        continue;
      }

      if (response.status === 429) {
        console.log(`fetchWithRetry: Rate limit exceeded (status 429), disabling key for the day: ${maskedApiKey}`);
        apiKeyManager.disableKeyForDay(apiKey);
        attempt++;
        continue;
      }

      console.log(`fetchWithRetry: Request successful with status: ${response.status}`);
      return response;
    } catch (error) {
      console.error(`fetchWithRetry: Request failed with error:`, error);
      console.log(`fetchWithRetry: Temporarily disabling key due to error: ${maskedApiKey}`);
      apiKeyManager.disableKeyTemporarily(apiKey);
      attempt++;
    }
  }

  console.error("fetchWithRetry: All API keys failed");
  throw new HttpError("All API keys failed", 500);
}
