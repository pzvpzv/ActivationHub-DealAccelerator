// Browser API client. Talks only to this app's server — no AI credentials in the browser.
// In the static build (VITE_STATIC=1, e.g. GitHub Pages) there is no server: the catalogue is a
// static file and the pipeline runs in the browser in keyword mode only.

export const STATIC_MODE = import.meta.env.VITE_STATIC === "1";

export async function fetchCatalogue() {
  const res = await fetch(STATIC_MODE ? `${import.meta.env.BASE_URL}catalogue.json` : "/api/catalogue");
  if (!res.ok) throw new Error(`Catalogue request failed (${res.status})`);
  return res.json();
}

export async function fetchHealth() {
  if (STATIC_MODE) return { ai: { configured: false }, static: true };
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error(`Health request failed (${res.status})`);
  return res.json();
}

export class RecommendError extends Error {
  constructor({ code, message, retryable }) {
    super(message);
    this.code = code;
    this.retryable = retryable ?? true;
  }
}

/**
 * Streams the recommendation pipeline. `onEvent` receives stage/intent events as they happen.
 * Resolves with the final result; rejects with RecommendError.
 */
async function runInBrowser({ query, mode, onEvent }) {
  if (mode !== "keywords") throw new RecommendError({ code: "ai_not_configured", message: "AI analysis needs the Activation Hub server; this static site can only run keyword matching.", retryable: false });
  const [{ runPipeline }, raw] = await Promise.all([import("../../server/services/pipeline.js"), fetchCatalogue()]);
  const catalogue = { ...raw, issues: [], byId: new Map(raw.resources.map((r) => [r.id, r])) };
  return runPipeline({ query, mode, catalogue }, (event) => onEvent?.(event));
}

export async function streamRecommendation({ query, mode = "ai", signal, onEvent }) {
  if (STATIC_MODE) return runInBrowser({ query, mode, onEvent });
  let res;
  try {
    res = await fetch("/api/recommend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, mode }), signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new RecommendError({ code: "network", message: "Couldn't reach the Activation Hub server.", retryable: true });
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new RecommendError(body.error || { code: "http_error", message: `Request failed (${res.status}).` });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const event = JSON.parse(line);
      if (event.type === "error") throw new RecommendError(event.error);
      if (event.type === "result") result = event.result;
      else onEvent?.(event);
    }
  }
  if (!result) throw new RecommendError({ code: "incomplete", message: "The response ended before recommendations were ready.", retryable: true });
  return result;
}
