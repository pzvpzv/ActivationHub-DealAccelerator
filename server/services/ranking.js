// Deterministic retrieval + ranking over the catalogue. Pure functions, no AI:
// every point awarded is recorded as a named signal so the ranking is inspectable and testable.
import { containsTerm, matchVocabulary } from "./vocabulary.js";

export const WEIGHTS = {
  capability: 5,          // per matched capability (max 3 counted)
  primaryCapability: 2,   // bonus when the first-named capability matches
  industryMatch: 4,
  industryMismatch: -3,   // resource is specific to a different industry
  goal: 3,
  assetType: 3,
  conceptInTitle: 3,
  conceptInBody: 1.5,
  conceptCap: 6,
  urgency: { immediate: { "ready-to-use": 5, attend: 0, customise: -4, build: -6 }, this_week: { "ready-to-use": 2, attend: 0, customise: -1, build: -3 } },
  slowTimeToValue: { immediate: { days: -2, weeks: -5 }, this_week: { weeks: -3 } },
  showModeWhenUrgent: 2,
  preferCustomisable: { customise: 4, build: 1, "ready-to-use": 0, attend: -1 },
  status: { "coming-soon": -8, raw: -2, undocumented: -1, retired: -100 },
};

// Which resource types satisfy each asset need.
const ASSET_TYPES = {
  demo: ["template", "walkthrough-deck", "accelerator"],
  walkthrough: ["walkthrough-deck", "recording"],
  template: ["template", "accelerator"],
  deck: ["walkthrough-deck", "collateral", "campaign"],
  recording: ["recording"],
  proposal: ["accelerator", "collateral", "campaign"],
  guide: ["guide", "lab"],
  training: ["course", "lab", "event", "recording"],
  event: ["event", "course"],
  tool: ["accelerator", "platform"],
  collateral: ["collateral", "campaign", "walkthrough-deck"],
  campaign: ["campaign"],
};

export const STRONG_SCORE = 10;
export const MAX_CANDIDATES = 12;

/** Merge the AI interpretation with the deterministic vocabulary reading of the raw query. */
export function effectiveIntent(query, intent, taxonomy) {
  const vocab = matchVocabulary(query, taxonomy);
  const aiCaps = intent.capabilities || [];
  const addedCaps = vocab.capabilities.filter((c) => !aiCaps.includes(c));
  return {
    ...intent,
    capabilities: [...aiCaps, ...addedCaps],
    industry: intent.industry ?? vocab.industry,
    backstop: { addedCapabilities: addedCaps, industryFromVocabulary: !intent.industry && vocab.industry ? vocab.industry : null },
  };
}

function haystacks(resource, taxonomy) {
  const capLabels = resource.capabilities.map((id) => taxonomy.capabilities.find((c) => c.id === id)?.label || "").join(" ");
  return {
    title: ` ${[resource.title, ...resource.keywords].join(" ").toLowerCase()} `,
    body: ` ${[resource.description, resource.purpose, ...resource.clientProblems, capLabels].join(" ").toLowerCase()} `,
  };
}

export function scoreResource(resource, intent, taxonomy) {
  const signals = [];
  const add = (kind, detail, points) => { if (points) signals.push({ kind, detail, points }); };
  let topical = false;

  const matchedCaps = intent.capabilities.filter((c) => resource.capabilities.includes(c));
  if (matchedCaps.length) {
    topical = true;
    matchedCaps.slice(0, 3).forEach((c) => add("capability", taxonomy.capabilities.find((x) => x.id === c)?.label || c, WEIGHTS.capability));
    if (intent.capabilities[0] && resource.capabilities.includes(intent.capabilities[0])) add("primary-capability", "matches the main topic", WEIGHTS.primaryCapability);
  }

  if (intent.industry) {
    const label = taxonomy.industries.find((i) => i.id === intent.industry)?.label || intent.industry;
    if (resource.industries.includes(intent.industry)) add("industry", label, WEIGHTS.industryMatch);
    else if (resource.industries.length) add("industry-mismatch", `specific to ${resource.industries.join(", ")}`, WEIGHTS.industryMismatch);
  }

  const goalMatch = intent.goal && resource.intents.includes(intent.goal);
  if (goalMatch) add("goal", intent.goal, WEIGHTS.goal);

  const typeMatch = (intent.assetNeed || []).find((need) => (ASSET_TYPES[need] || []).includes(resource.type));
  if (typeMatch) add("asset-type", `${typeMatch} → ${resource.type}`, WEIGHTS.assetType);

  const { title, body } = haystacks(resource, taxonomy);
  let conceptPoints = 0;
  for (const concept of intent.searchConcepts || []) {
    const term = concept.toLowerCase().trim();
    if (term.length < 3) continue;
    if (containsTerm(title, term)) conceptPoints += WEIGHTS.conceptInTitle;
    else if (containsTerm(body, term)) conceptPoints += WEIGHTS.conceptInBody;
  }
  conceptPoints = Math.min(conceptPoints, WEIGHTS.conceptCap);
  if (conceptPoints) add("concepts", "search concepts found in title/keywords/description", conceptPoints);
  if (conceptPoints >= 3) topical = true;
  if (goalMatch && typeMatch && !intent.capabilities.length) topical = true;
  if (goalMatch && typeMatch && intent.industry && resource.industries.includes(intent.industry)) topical = true;

  const horizon = intent.timeHorizon;
  if (WEIGHTS.urgency[horizon]) {
    add("urgency", `${horizon} → ${resource.readiness}`, WEIGHTS.urgency[horizon][resource.readiness] || 0);
    add("time-to-value", `${horizon} → ${resource.timeToValue}`, WEIGHTS.slowTimeToValue[horizon]?.[resource.timeToValue] || 0);
    if (horizon === "immediate" && resource.modes.includes("show")) add("show-ready", "client-facing", WEIGHTS.showModeWhenUrgent);
  } else if (intent.preference === "ready_to_use") {
    add("preference", `ready_to_use → ${resource.readiness}`, WEIGHTS.urgency.this_week[resource.readiness] || 0);
  }
  if (intent.preference === "customisable") add("preference", `customisable → ${resource.readiness}`, WEIGHTS.preferCustomisable[resource.readiness] || 0);

  add("status", resource.status, WEIGHTS.status[resource.status] || 0);

  const score = Math.round(signals.reduce((sum, s) => sum + s.points, 0) * 10) / 10;
  return { id: resource.id, score, topical, signals };
}

export const MAX_PER_TYPE = 4;

/**
 * Shortlist for the explanation step. Highest scores first, but capped per resource type and
 * guaranteed to include the best items for each mode (show / learn / build), so one abundant
 * type (e.g. templates) can't crowd out a ready-to-show deck or an accelerator.
 */
export function diversify(sorted, byId, max = MAX_CANDIDATES) {
  const picked = [];
  const perType = new Map();
  const take = (c) => { picked.push(c); perType.set(byId.get(c.id).type, (perType.get(byId.get(c.id).type) || 0) + 1); };
  for (const mode of ["show", "learn", "build"]) {
    sorted.filter((c) => byId.get(c.id).modes.includes(mode)).slice(0, 2).forEach((c) => { if (!picked.includes(c)) take(c); });
  }
  for (const c of sorted) {
    if (picked.length >= max) break;
    if (picked.includes(c) || (perType.get(byId.get(c.id).type) || 0) >= MAX_PER_TYPE) continue;
    take(c);
  }
  return picked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, max);
}

const PREFERENCE_KINDS = new Set(["goal", "asset-type", "urgency", "show-ready", "preference"]);
const byScore = (a, b) => b.score - a.score || a.id.localeCompare(b.id);

/** A request with no topic but a clear purpose ("something ready to show tomorrow") can still be served. */
export function hasPurposeWithoutTopic(intent) {
  return !intent.capabilities.length && Boolean(intent.goal || intent.assetNeed?.length || intent.preference !== "no_preference" || intent.timeHorizon !== "unspecified");
}

export function rankCatalogue(intent, catalogue) {
  const scored = catalogue.resources.map((r) => scoreResource(r, intent, catalogue.taxonomy));
  let matched = scored.filter((s) => s.topical && s.score > 0).sort(byScore);
  let basis = "topic";
  if (!matched.length && hasPurposeWithoutTopic(intent)) {
    // Fallback pass: rank on purpose signals only (goal, asset type, urgency, preference).
    matched = scored.filter((s) => s.score > 0 && s.signals.some((x) => PREFERENCE_KINDS.has(x.kind) && x.points > 0)).sort(byScore);
    basis = "purpose";
  }
  const excluded = scored.length - matched.length;
  return { candidates: diversify(matched, catalogue.byId), totalMatched: matched.length, excluded, basis };
}

const STOPWORDS = new Set("that this with from about something client clients need want help ready show some into their your have what".split(" "));

/** Search concepts containing a significant word that appears nowhere in the inventory. */
export function unfoundConcepts(intent, catalogue, query = "") {
  const corpus = catalogue.resources.map((r) => [r.title, r.description, r.purpose, ...r.keywords, ...r.clientProblems].join(" ").toLowerCase()).join(" \n ");
  const asked = ` ${query.toLowerCase()} `;
  // Only report words the user actually used — not phrasings the interpreter added.
  return (intent.searchConcepts || []).filter((concept) =>
    concept.toLowerCase().split(/[^a-z0-9&]+/).some((w) => w.length >= 4 && !STOPWORDS.has(w) && containsTerm(asked, w) && !containsTerm(corpus, w) && !containsTerm(corpus, w.replace(/s$/, ""))));
}

/** Grounded, deterministic statements about what the inventory could and couldn't cover. */
export function assessCoverage(intent, ranked, catalogue, query = "") {
  const { taxonomy, byId } = catalogue;
  const top = ranked.candidates;
  const notes = [];
  const best = top[0]?.score ?? 0;
  const strong = top.some((c) => c.score >= STRONG_SCORE && c.signals.some((s) => s.kind === "capability"));
  const quality = !top.length ? "none" : strong && ranked.basis !== "purpose" ? "strong" : "partial";
  if (ranked.basis === "purpose") notes.push("You didn't name a topic, so these are general starting points chosen for timing and format — add the client topic for a sharper set.");

  if (intent.industry && top.length) {
    const label = taxonomy.industries.find((i) => i.id === intent.industry)?.label;
    const specificAnywhere = catalogue.resources.filter((r) => r.industries.includes(intent.industry) && r.status !== "coming-soon");
    const specificShortlisted = top.some((c) => byId.get(c.id).industries.includes(intent.industry));
    if (!specificAnywhere.length) notes.push(`Nothing in the inventory is specific to ${label}; these recommendations are cross-industry.`);
    else if (!specificShortlisted) notes.push(`The ${label}-specific resources in the inventory don't match this topic, so these recommendations are cross-industry.`);
  }
  const uncovered = intent.capabilities.filter((c) => !catalogue.resources.some((r) => r.capabilities.includes(c) && r.status !== "coming-soon"));
  for (const c of uncovered) notes.push(`No available resource covers ${taxonomy.capabilities.find((x) => x.id === c)?.label || c} yet.`);
  const missing = unfoundConcepts(intent, catalogue, query);
  if (missing.length) notes.push(`Nothing in the inventory mentions ${missing.map((m) => `“${m}”`).join(", ")}.`);
  if (ranked.basis !== "purpose" && intent.capabilities.length === 0 && (intent.searchConcepts || []).length && quality !== "strong") {
    notes.push("The request didn't map to a topic the inventory is organised around, so matches are based on wording only.");
  }
  return { quality, bestScore: best, notes };
}
