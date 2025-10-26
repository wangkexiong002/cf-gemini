import { ApiKeyManager } from "./apiKeyManager";
import { HttpError } from "./errors";
import { makeHeaders, maskApiKey } from "./helpers";

export async function fetchWithRetry(
  apiKeyManager: ApiKeyManager,
  url: string,
  options: RequestInit
): Promise<Response> {
  const maxRetries = apiKeyManager.getTotalKeys();
  if (maxRetries === 0) {
    throw new HttpError("No key found in Authorization header.", 500);
  }

  let attempt = 0;
  while (attempt < maxRetries) {
    const apiKey = await apiKeyManager.getAvailableKey();
    console.log(`fetchWithRetry - returned ${apiKey}`);
    if (!apiKey) {
      throw new HttpError("No key available now while some of them are still in block", 500);
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
      console.log(`fetchWithRetry - recevied response ${response.status} from ${url} with ${maskedApiKey}`);

      if (response.status >= 500) {
        await apiKeyManager.disableKeyTemporarily(apiKey);
        attempt++;
        continue;
      }

      if (response.status === 429) {
        await apiKeyManager.disableKeyForDay(apiKey);
        attempt++;
        continue;
      }

      if (response.status === 200) {
        return response;
      } else {
        // response with 400 and 406 indicates keys not enabled or insufficient funds
        // this may be fixed that cannot control here, say user recharges or adds that key offline
        await apiKeyManager.disableKeyTemporarily(apiKey, 5);
        attempt++;
        continue;
      }
    } catch (error) {
      await apiKeyManager.disableKeyTemporarily(apiKey);
      attempt++;
    }
  }

  throw new HttpError("All keys are tried and in block", 500);
}
