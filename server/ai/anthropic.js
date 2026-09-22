// AI provider integration. Server-side only — the API key never leaves this process.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export const AI_MODEL = process.env.AI_MODEL || "claude-opus-5";
const AI_EFFORT = process.env.AI_EFFORT || "low";

export class AIError extends Error {
  constructor(code, message, { retryable = false, cause } = {}) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.cause = cause;
  }
}

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client = null;
function getClient() {
  if (!aiConfigured()) throw new AIError("ai_not_configured", "ANTHROPIC_API_KEY is not set on the server.");
  // baseURL is pinned so an ANTHROPIC_BASE_URL inherited from another tool can't redirect calls.
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.AI_BASE_URL || "https://api.anthropic.com", timeout: 60_000, maxRetries: 1 });
  return client;
}

/**
 * One structured call: the response is constrained to `schema` and validated by the SDK.
 * Returns { data, usage, ms }.
 */
export async function structuredCall({ system, user, schema, maxTokens = 4000 }) {
  const started = Date.now();
  let response;
  try {
    response = await getClient().messages.parse({
      model: AI_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { effort: AI_EFFORT, format: zodOutputFormat(schema) },
    });
  } catch (error) {
    if (error instanceof AIError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new AIError("ai_auth", "The AI provider rejected the API key.", { cause: error });
    if (error instanceof Anthropic.RateLimitError) throw new AIError("ai_rate_limited", "The AI provider is rate limiting requests.", { retryable: true, cause: error });
    if (error instanceof Anthropic.BadRequestError) throw new AIError("ai_bad_request", `The AI provider rejected the request: ${error.message}`, { cause: error });
    if (error instanceof Anthropic.APIConnectionError) throw new AIError("ai_unreachable", "Could not reach the AI provider.", { retryable: true, cause: error });
    if (error instanceof Anthropic.APIError) throw new AIError("ai_provider_error", `AI provider error (${error.status}).`, { retryable: true, cause: error });
    // Zod / JSON parse failures from the SDK helper land here.
    throw new AIError("ai_malformed", "The AI response did not match the expected structure.", { retryable: true, cause: error });
  }
  if (response.stop_reason === "refusal") throw new AIError("ai_refused", "The AI model declined this request.");
  if (response.stop_reason === "max_tokens") throw new AIError("ai_malformed", "The AI response was cut off before it was complete.", { retryable: true });
  if (!response.parsed_output) throw new AIError("ai_malformed", "The AI response could not be parsed.", { retryable: true });
  return { data: response.parsed_output, usage: response.usage, ms: Date.now() - started };
}
