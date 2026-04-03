import { buildHealthResponse } from "../lib/briefing-service.mjs";

export const config = {
  runtime: "nodejs"
};

export default function handler(_request, response) {
  response.status(200).json(buildHealthResponse());
}
