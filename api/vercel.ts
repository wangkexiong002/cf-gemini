import { kv } from "@vercel/kv"
import { startWorker } from "../src/worker/start";
import { useVercelKV } from "../src/wrapper/kv";

export default async function handler(request: Request): Promise<Response> {
  return startWorker(request, useVercelKV(kv));
}

export const config = {
  runtime: "edge",
  // Available languages and regions for Google AI Studio and Gemini API
  // https://ai.google.dev/gemini-api/docs/available-regions#available_regions
  // Vercel Edge Network Regions
  // https://vercel.com/docs/edge-network/regions#region-list
  regions: [
    "arn1",
    "bom1",
    "cdg1",
    "cle1",
    "cpt1",
    "dub1",
    "fra1",
    "gru1",
    //"hkg1",
    "hnd1",
    "iad1",
    "icn1",
    "kix1",
    "pdx1",
    "sfo1",
    "sin1",
    "syd1",
  ],
}