// Orchestrates intent → retrieval → ranking → explanation, emitting each real stage as it happens.
// Browser-safe: the AI steps are injected, so the same pipeline runs on the server (AI) and in
// the static GitHub Pages build (keyword mode only).
import { interpretWithoutAI } from "./vocabulary.js";
import { effectiveIntent, rankCatalogue, assessCoverage, WEIGHTS } from "./ranking.js";
import { explainFromMetadata } from "./explain-metadata.js";

const SECTION_LABELS = { show: "Show it", learn: "Learn it", build: "Build it" };

function toCard(rec, resource, taxonomy) {
  return {
    id: resource.id,
    title: resource.title,
    type: resource.type,
    typeLabel: taxonomy.types.find((t) => t.id === resource.type)?.label || resource.type,
    status: resource.status,
    readiness: resource.readiness,
    readinessLabel: taxonomy.readiness.find((t) => t.id === resource.readiness)?.label || resource.readiness,
    timeToValue: resource.timeToValue,
    technicalLevel: resource.technicalLevel,
    description: resource.description,
    whatYouCanDo: resource.whatYouCanDo,
    prerequisites: resource.prerequisites,
    caveats: resource.caveats,
    authoritativeSource: resource.authoritativeSource,
    actions: resource.actions,
    contact: resource.contact,
    sessions: resource.sessions || null,
    whyItFits: rec.whyItFits,
    bestFor: rec.bestFor,
  };
}

/**
 * @param {{query: string, mode?: "ai"|"keywords", catalogue: object, ai?: {model: string, interpretIntent: Function, explainWithAI: Function, isAIError: Function}}} input
 * @param {(event: object) => void} emit
 */
export async function runPipeline({ query, mode = "ai", catalogue, ai }, emit) {
  if (mode === "ai" && !ai) throw new Error("AI mode requires AI dependencies");
  const debug = { query, mode, model: mode === "ai" ? ai.model : null, catalogueSize: catalogue.resources.length, catalogueIssues: catalogue.issues?.length ?? 0, timings: {} };

  // 1 — Understand
  emit({ type: "stage", stage: "understand", status: "active" });
  let interpreted;
  try {
    interpreted = mode === "keywords" ? interpretWithoutAI(query, catalogue.taxonomy) : await ai.interpretIntent(query, catalogue.taxonomy);
  } catch (error) {
    emit({ type: "stage", stage: "understand", status: "error" });
    throw error;
  }
  debug.rawIntent = interpreted.intent;
  debug.intentSource = interpreted.source;
  debug.timings.understandMs = interpreted.ms ?? 0;
  const intent = effectiveIntent(query, interpreted.intent, catalogue.taxonomy);
  debug.effectiveIntent = intent;
  emit({ type: "stage", stage: "understand", status: "done" });
  emit({ type: "intent", intent, source: interpreted.source });

  // 2 — Retrieve & rank (deterministic)
  emit({ type: "stage", stage: "retrieve", status: "active" });
  const t0 = Date.now();
  const ranked = rankCatalogue(intent, catalogue);
  const coverage = assessCoverage(intent, ranked, catalogue, query);
  debug.timings.rankMs = Date.now() - t0;
  debug.weights = WEIGHTS;
  debug.candidates = ranked.candidates.map((c) => ({ ...c, title: catalogue.byId.get(c.id).title, type: catalogue.byId.get(c.id).type }));
  debug.totalMatched = ranked.totalMatched;
  debug.coverage = coverage;
  emit({ type: "stage", stage: "retrieve", status: "done", detail: `${ranked.totalMatched} of ${catalogue.resources.length} resources matched` });

  if (!ranked.candidates.length) {
    emit({ type: "stage", stage: "explain", status: "skipped" });
    return { query, intent, coverage, explanationSource: null, headline: null, pathSummary: null, sections: [], clarifyingQuestion: intent.clarifyingQuestion, debug };
  }

  // 3 — Explain & order
  emit({ type: "stage", stage: "explain", status: "active" });
  let explained;
  let explanationWarning = null;
  if (mode === "keywords") {
    explained = explainFromMetadata({ intent, candidates: ranked.candidates, catalogue });
  } else {
    try {
      explained = await ai.explainWithAI({ query, intent, candidates: ranked.candidates, coverage, catalogue });
      if (!explained.recommendations.length) explanationWarning = { code: "ai_malformed", message: "The AI returned no usable recommendations." };
    } catch (error) {
      if (!ai.isAIError(error)) throw error;
      explanationWarning = { code: error.code, message: error.message };
    }
    if (explanationWarning) {
      explained = explainFromMetadata({ intent, candidates: ranked.candidates, catalogue });
    }
  }
  debug.timings.explainMs = explained.ms ?? 0;
  debug.explanation = { source: explained.source, rejected: explained.rejected, order: explained.recommendations.map((r) => ({ id: r.id, section: r.section, sectionAdjusted: r.sectionAdjusted || false })) };
  emit({ type: "stage", stage: "explain", status: explanationWarning ? "degraded" : "done" });

  // Sections appear in the order their first recommendation appears.
  const sections = [];
  for (const rec of explained.recommendations) {
    let section = sections.find((s) => s.key === rec.section);
    if (!section) sections.push((section = { key: rec.section, label: SECTION_LABELS[rec.section], items: [] }));
    section.items.push(toCard(rec, catalogue.byId.get(rec.id), catalogue.taxonomy));
  }

  return {
    query, intent, coverage, sections,
    headline: explained.headline, pathSummary: explained.pathSummary,
    explanationSource: explained.source, explanationWarning,
    clarifyingQuestion: intent.clarifyingQuestion,
    debug,
  };
}
