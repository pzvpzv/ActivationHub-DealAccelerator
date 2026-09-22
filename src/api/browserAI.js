// AI dependencies for running the pipeline in the browser with the user's own key.
// Loaded on demand so the SDK is only downloaded when someone actually uses AI.
import Anthropic from "@anthropic-ai/sdk";
import { AIError, createStructuredCall, DEFAULT_MODEL } from "../../server/ai/structured.js";
import { interpretIntent } from "../../server/services/intent.js";
import { explainWithAI } from "../../server/services/explain.js";

export function createBrowserAI(apiKey) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, baseURL: "https://api.anthropic.com", timeout: 60_000, maxRetries: 1 });
  const call = createStructuredCall({ client, model: DEFAULT_MODEL, effort: "low" });
  return {
    model: DEFAULT_MODEL,
    interpretIntent: (query, taxonomy) => interpretIntent(query, taxonomy, { call }),
    explainWithAI: (args) => explainWithAI({ ...args, call }),
    isAIError: (error) => error instanceof AIError,
  };
}
