// Reranks the deterministic candidates and writes grounded rationale.
// The AI can only choose from candidate ids (enforced by the output schema and re-checked here).
import { z } from "zod";
import { structuredCall } from "../ai/anthropic.js";

import { MAX_RECOMMENDATIONS } from "./explain-metadata.js";

export { explainFromMetadata } from "./explain-metadata.js";

const SECTIONS = ["show", "learn", "build"];

function schemaFor(candidateIds) {
  return z.object({
    headline: z.string(),
    pathSummary: z.string(),
    recommendations: z.array(z.object({
      id: z.enum(candidateIds),
      section: z.enum(SECTIONS),
      whyItFits: z.string(),
      bestFor: z.string(),
    })),
  });
}

const SYSTEM = `You help IBM Consulting practitioners decide which existing AIIS Activation Hub resources to use for a client need.

You receive the interpreted request and a shortlist of candidate resources that a deterministic ranking already retrieved from the catalogue. Choose and order the most useful ones and explain each choice.

Rules:
- Recommend only candidates from the shortlist, by id. Never mention resources, tools, people or facts that are not in the shortlist data.
- Pick 3 to ${MAX_RECOMMENDATIONS}, ordered by usefulness for this request. Leave out candidates that would not genuinely help, even if they scored well. Do not include two items that do the same job unless each adds something.
- section: "show" = ready or nearly ready for a client conversation; "learn" = helps the user understand or prepare; "build" = something they customise or use to create something. Choose by how the resource serves this request, consistent with its modes.
- Respect time pressure: when the time horizon is immediate or the preference is ready_to_use, lead with ready-to-use material and only include build items as a later step. When they want to customise or build, lead with build items.
- whyItFits: one sentence tying the resource to what they asked, grounded in its metadata (e.g. "Recommended because you're preparing a Finance Transformation demo and this deck is client-ready today."). Mention an important caveat or state if it changes the decision. No confidence scores.
- bestFor: a short phrase describing the situation it suits.
- headline: a short statement of the recommended path (max ~12 words). pathSummary: 1–2 sentences explaining the sequence (what to do first, what next). If coverage notes say something is missing, acknowledge it honestly.
- Plain, direct enterprise tone. No marketing language.`;

function candidatePayload(candidates, byId) {
  return candidates.map((c) => {
    const r = byId.get(c.id);
    return {
      id: r.id, title: r.title, type: r.type, modes: r.modes, status: r.status, readiness: r.readiness,
      timeToValue: r.timeToValue, technicalLevel: r.technicalLevel, industries: r.industries, capabilities: r.capabilities,
      description: r.description, purpose: r.purpose, whatYouCanDo: r.whatYouCanDo, prerequisites: r.prerequisites, caveats: r.caveats,
      rankingScore: c.score, matchedSignals: c.signals.map((s) => `${s.kind}: ${s.detail} (${s.points > 0 ? "+" : ""}${s.points})`),
    };
  });
}

export async function explainWithAI({ query, intent, candidates, coverage, catalogue }) {
  const ids = candidates.map((c) => c.id);
  const { data, usage, ms } = await structuredCall({
    system: SYSTEM,
    user: JSON.stringify({ request: query, interpretedIntent: intent, coverageNotes: coverage.notes, matchQuality: coverage.quality, shortlist: candidatePayload(candidates, catalogue.byId) }, null, 1),
    schema: schemaFor(ids),
    maxTokens: 6000,
  });

  const rejected = [];
  const seen = new Set();
  const recommendations = [];
  for (const rec of data.recommendations) {
    const resource = catalogue.byId.get(rec.id);
    if (!ids.includes(rec.id) || !resource) { rejected.push({ id: rec.id, reason: "not in shortlist" }); continue; }
    if (seen.has(rec.id)) { rejected.push({ id: rec.id, reason: "duplicate" }); continue; }
    seen.add(rec.id);
    const section = resource.modes.includes(rec.section) ? rec.section : resource.modes[0];
    recommendations.push({ id: rec.id, section, whyItFits: rec.whyItFits, bestFor: rec.bestFor, sectionAdjusted: section !== rec.section });
  }
  return { headline: data.headline, pathSummary: data.pathSummary, recommendations: recommendations.slice(0, MAX_RECOMMENDATIONS), rejected, usage, ms, source: "ai" };
}

