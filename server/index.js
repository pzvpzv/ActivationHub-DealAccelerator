import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { getCatalogue } from "./catalogue/load.js";
import { aiConfigured, AIError, AI_MODEL } from "./ai/anthropic.js";
import { recommend } from "./services/recommend.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => {
  const catalogue = getCatalogue();
  res.json({ ai: { configured: aiConfigured(), model: AI_MODEL }, catalogue: { resources: catalogue.resources.length, issues: catalogue.issues } });
});

app.get("/api/catalogue", (_req, res) => {
  const { taxonomy, resources, hubUrl, generatedFrom } = getCatalogue();
  res.json({ taxonomy, resources, hubUrl, generatedFrom });
});

// Streams newline-delimited JSON: stage updates as each real step completes, then the result.
app.post("/api/recommend", async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
  const mode = req.body?.mode === "keywords" ? "keywords" : "ai";
  if (query.length < 3 || query.length > 1000) return res.status(400).json({ error: { code: "invalid_query", message: "Describe your need in 3–1000 characters." } });
  if (mode === "ai" && !aiConfigured()) return res.status(503).json({ error: { code: "ai_not_configured", message: "AI analysis isn't configured on this server (ANTHROPIC_API_KEY is missing).", retryable: false } });

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  const emit = (event) => res.write(`${JSON.stringify(event)}\n`);
  try {
    const result = await recommend({ query, mode }, emit);
    emit({ type: "result", result });
  } catch (error) {
    const known = error instanceof AIError;
    // Log the failure without the user's request text.
    console.error(`[recommend] ${known ? error.code : "internal_error"}: ${error.message}`);
    emit({ type: "error", error: { code: known ? error.code : "internal_error", message: known ? error.message : "Something went wrong while preparing recommendations.", retryable: known ? error.retryable : true } });
  }
  res.end();
});

const dist = path.resolve(here, "../dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT || 8787);
const server = app.listen(port, () => {
  const catalogue = getCatalogue();
  console.log(`AIIS Activation Hub API on http://localhost:${port} — ${catalogue.resources.length} resources, AI ${aiConfigured() ? `enabled (${AI_MODEL})` : "NOT configured"}`);
});
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") console.error(`Port ${port} is already in use — another copy of the API is probably running. Stop it (lsof -ti:${port} | xargs kill) or set PORT in .env.`);
  else console.error(error);
  process.exit(1);
});
