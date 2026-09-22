// Deterministic reading of a query against the catalogue taxonomy. Used as a transparent
// backstop to the AI interpretation, and on its own in explicitly-chosen keyword mode.

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const containsTerm = (text, term) => new RegExp(`(^|[^a-z0-9])${escape(term.toLowerCase())}([^a-z0-9]|$)`).test(text);

function termsFor(entry) {
  return [entry.label, ...(entry.synonyms || [])].map((t) => t.toLowerCase());
}

export function matchVocabulary(query, taxonomy) {
  const text = ` ${query.toLowerCase()} `;
  const capabilities = taxonomy.capabilities.filter((c) => termsFor(c).some((t) => containsTerm(text, t))).map((c) => c.id);
  const industry = taxonomy.industries.find((i) => termsFor(i).some((t) => containsTerm(text, t)))?.id ?? null;

  let timeHorizon = "unspecified";
  if (/\b(today|tomorrow|tonight|this morning|this afternoon|in an hour|asap|right now|urgent)\b/.test(text)) timeHorizon = "immediate";
  else if (/\b(this week|monday|tuesday|wednesday|thursday|friday|in (two|2|three|3) days)\b/.test(text)) timeHorizon = "this_week";
  else if (/\b(next week|next month|this quarter|next quarter|in (two|2|three|3) weeks)\b/.test(text)) timeHorizon = "later";

  let preference = "no_preference";
  if (/\b(ready to show|ready-to-show|ready to use|off the shelf|as is|no time)\b/.test(text) || timeHorizon === "immediate") preference = "ready_to_use";
  else if (/\b(customi[sz]e|tailor|adapt|build|brand|my client's data|convert)\b/.test(text)) preference = "customisable";

  let goal = null;
  if (/\b(proposal|rfp|bid|sow|pricing|commercial)\b/.test(text)) goal = "propose";
  else if (/\b(build|customi[sz]e|convert|prototype)\b/.test(text)) goal = "build_customise";
  else if (/\b(demo|show|demonstrate|walkthrough)\b/.test(text)) goal = "demonstrate";
  else if (/\b(learn|understand|get up to speed|training|explain)\b/.test(text)) goal = "learn";
  else if (/\b(meeting|conversation|workshop|pitch|call)\b/.test(text)) goal = "prepare_conversation";
  else if (/\b(event|session|masterclass|lab|register|attend)\b/.test(text)) goal = "find_event";

  const assetNeed = taxonomy.assetNeeds.filter((a) => containsTerm(text, a) || containsTerm(text, `${a}s`));

  const stop = new Set("i need want a an the to for of my our with and or some something about can me show help get find what is are this that on in it client clients who have has be do does".split(" "));
  const searchConcepts = query.toLowerCase().replace(/[^a-z0-9&\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));

  return { goal, industry, capabilities, assetNeed, timeHorizon, preference, searchConcepts };
}
