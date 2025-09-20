import { Buffer } from "node:buffer";
import { API_CLIENT } from "../config/constants";

export const makeHeaders = (apiKey: string | undefined, more: Record<string, string> = {}): Record<string, string> => ({
  "x-goog-api-client": API_CLIENT,
  ...(apiKey && { "x-goog-api-key": apiKey }),
  ...more
});

export const generateId = (): string => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomChar = (): string => characters[Math.floor(Math.random() * characters.length)];
  return Array.from({ length: 29 }, randomChar).join("");
};

export const parseImg = async (url: string): Promise<any> => {
  let mimeType: string | null, data: string;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText} (${url})`);
      }
      mimeType = response.headers.get("content-type");
      data = Buffer.from(await response.arrayBuffer()).toString("base64");
    } catch (err: any) {
      throw new Error("Error fetching image: " + err.toString());
    }
  } else {
    const match = url.match(/^data:(?<mimeType>.*?)(;base64)?,(?<data>.*)$/);
    if (!match) {
      throw new Error("Invalid image data: " + url);
    }
    const groups = match.groups as { mimeType: string; data: string };
    ({ mimeType, data } = groups);
  }
  return {
    inlineData: {
      mimeType,
      data,
    },
  };
};

/**
 * Masks the middle part of an API key with asterisks.
 * @param apiKey The API key to mask
 * @returns The masked API key
 */
export const maskApiKey = (apiKey: string): string => {
  if (apiKey.length <= 8) {
    // If the key is too short, just return a masked version
    return '****';
  }
  const start = apiKey.substring(0, 4);
  const end = apiKey.substring(apiKey.length - 4);
  return `${start}****${end}`;
};
