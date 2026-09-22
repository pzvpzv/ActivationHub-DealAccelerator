// Structured Claude calls, shared by the Node server and the browser (GitHub Pages) build.
// Environment-agnostic: the caller supplies an Anthropic client, model and effort.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export const DEFAULT_MODEL = "claude-opus-5";

export class AIError extends Error {
  constructor(code, message, { retryable = false, cause } = {}) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.cause = cause;
  }
}

/**
 * Returns a function that makes one structured call: the response is constrained to `schema`
 * and validated by the SDK. The function resolves to { data, usage, ms }.
 */
export function createStructuredCall({ client, model = DEFAULT_MODEL, effort = "low" }) {
  return async function structuredCall({ system, user, schema, maxTokens = 4000 }) {
    const started = Date.now();
    let response;
    try {
      response = await client.messages.parse({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
        output_config: { effort, format: zodOutputFormat(schema) },
      });
    } catch (error) {
      if (error instanceof AIError) throw error;
      if (error instanceof Anthropic.AuthenticationError) throw new AIError("ai_auth", "The AI provider rejected the API key.", { cause: error });
      if (error instanceof Anthropic.PermissionDeniedError) throw new AIError("ai_auth", "This API key isn't allowed to use the model.", { cause: error });
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
  };
}
