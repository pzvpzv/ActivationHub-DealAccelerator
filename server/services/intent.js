// Intent analysis: turns a natural-language request into structured context,
// constrained to the catalogue's own taxonomy so it can be matched deterministically.
import { z } from "zod";
import { structuredCall } from "../ai/anthropic.js";
import { interpretWithoutAI } from "./vocabulary.js";

export { interpretWithoutAI };

const enumOf = (list) => z.enum(list.map((x) => (typeof x === "string" ? x : x.id)));

export function buildIntentSchema(taxonomy) {
  return z.object({
    goal: enumOf(taxonomy.goals).nullable(),
    goalSummary: z.string(),
    client: z.string().nullable(),
    industry: enumOf(taxonomy.industries).nullable(),
    industryMentioned: z.string().nullable(),
    businessProblem: z.string().nullable(),
    capability: z.string().nullable(),
    capabilities: z.array(enumOf(taxonomy.capabilities)),
    assetNeed: z.array(enumOf(taxonomy.assetNeeds)),
    urgency: z.string().nullable(),
    timeHorizon: z.enum(["immediate", "this_week", "later", "unspecified"]),
    preference: z.enum(["ready_to_use", "customisable", "no_preference"]),
    constraints: z.array(z.string()),
    searchConcepts: z.array(z.string()),
    clarifyingQuestion: z.string().nullable(),
  });
}

function systemPrompt(taxonomy, today) {
  const list = (items) => items.map((x) => `- ${x.id}: ${x.label}${x.synonyms?.length ? ` (e.g. ${x.synonyms.slice(0, 6).join(", ")})` : ""}`).join("\n");
  return `You interpret requests from IBM Consulting practitioners using the AIIS Activation Hub. They describe what they are trying to accomplish for a client; you turn that into structured context used to search a catalogue of internal resources and accelerators.

Your only job is interpretation. Do not recommend resources and do not use outside knowledge about what assets exist.

Rules:
- Extract only what the request states or clearly implies. Use null or an empty array when something is not there. Never invent a client name, industry, date or constraint.
- "client" is a named client organisation only ("a banking client" is an industry, not a client name).
- Map to the controlled vocabularies below. "industryMentioned" and "businessProblem" keep the user's own wording.
- "capabilities": every vocabulary entry the request is about, most important first. A request about a finance-related process should include finance-transformation plus the specific process.
- "assetNeed": what kind of thing would help (a demo request usually needs demo, walkthrough and template).
- "timeHorizon": immediate = today/tomorrow or "ready to show now"; this_week = within about five working days; later = further out; unspecified = no time signal. Today is ${today}.
- "preference": ready_to_use when they have little time or ask for something ready; customisable when they want to build, tailor or brand something; otherwise no_preference.
- "searchConcepts": 3–8 short phrases useful for searching titles and descriptions, in the user's domain language.
- "clarifyingQuestion": ask one short question ONLY if the request is so open that neither the topic nor the purpose can be inferred (for example "I need a demo."). Otherwise null.

Goals:
${list(taxonomy.goals)}

Capabilities:
${list(taxonomy.capabilities)}

Industries:
${list(taxonomy.industries)}

Asset needs: ${taxonomy.assetNeeds.join(", ")}`;
}

export async function interpretIntent(query, taxonomy, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const schema = buildIntentSchema(taxonomy);
  const { data, usage, ms } = await structuredCall({
    system: systemPrompt(taxonomy, today),
    user: `Request: """${query}"""`,
    schema,
    maxTokens: 3000,
  });
  return { intent: data, source: "ai", usage, ms };
}

