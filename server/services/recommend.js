// Server entry to the recommendation pipeline: real catalogue from disk + AI provider.
import { getCatalogue } from "../catalogue/load.js";
import { AIError, AI_MODEL } from "../ai/anthropic.js";
import { interpretIntent } from "./intent.js";
import { explainWithAI } from "./explain.js";
import { runPipeline } from "./pipeline.js";

const ai = { model: AI_MODEL, interpretIntent, explainWithAI, isAIError: (error) => error instanceof AIError };

export function recommend({ query, mode = "ai" }, emit) {
  return runPipeline({ query, mode, catalogue: getCatalogue(), ai }, emit);
}
