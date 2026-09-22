// Server-side AI provider: key from the environment, never sent to the browser.
import Anthropic from "@anthropic-ai/sdk";
import { AIError, createStructuredCall, DEFAULT_MODEL } from "./structured.js";

export { AIError };
export const AI_MODEL = process.env.AI_MODEL || DEFAULT_MODEL;
const AI_EFFORT = process.env.AI_EFFORT || "low";

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let call = null;

export function structuredCall(request) {
  if (!aiConfigured()) return Promise.reject(new AIError("ai_not_configured", "ANTHROPIC_API_KEY is not set on the server."));
  // baseURL is pinned so an ANTHROPIC_BASE_URL inherited from another tool can't redirect calls.
  call ??= createStructuredCall({
    client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.AI_BASE_URL || "https://api.anthropic.com", timeout: 60_000, maxRetries: 1 }),
    model: AI_MODEL,
    effort: AI_EFFORT,
  });
  return call(request);
}
