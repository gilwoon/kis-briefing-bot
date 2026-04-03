import { buildBriefingResponse } from "../lib/briefing-service.mjs";

export const config = {
  runtime: "nodejs"
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const symbols = Array.isArray(request.body?.symbols) ? request.body.symbols : [];
    const result = await buildBriefingResponse(symbols);
    response.status(200).json(result);
  } catch (error) {
    response.status(500).json({
      source: "server-error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
