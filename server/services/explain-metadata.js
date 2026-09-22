// Metadata-only explanation (no AI). Browser-safe: no Node or SDK imports.

export const MAX_RECOMMENDATIONS = 6;

const READINESS_PHRASE = { "ready-to-use": "ready to use now", attend: "something to watch or attend", customise: "needs customising first", build: "needs engineering work" };

/** Used when AI explanation is unavailable, and labelled as such. */
export function explainFromMetadata({ intent, candidates, catalogue }) {
  const { byId, taxonomy } = catalogue;
  const urgent = intent.timeHorizon === "immediate" || intent.preference === "ready_to_use";
  const recommendations = candidates.slice(0, MAX_RECOMMENDATIONS).map((c) => {
    const r = byId.get(c.id);
    const caps = c.signals.filter((s) => s.kind === "capability").map((s) => s.detail);
    const industry = c.signals.find((s) => s.kind === "industry")?.detail;
    const parts = [];
    if (caps.length) parts.push(`covers ${caps.join(" and ")}`);
    if (industry) parts.push(`is specific to ${industry}`);
    parts.push(READINESS_PHRASE[r.readiness] || r.readiness);
    const section = urgent && r.modes.includes("show") ? "show" : intent.preference === "customisable" && r.modes.includes("build") ? "build" : r.modes[0];
    return { id: r.id, section, whyItFits: `Matched on catalogue metadata: ${parts.join("; ")}.`, bestFor: r.purpose };
  });
  const capLabel = taxonomy.capabilities.find((x) => x.id === intent.capabilities[0])?.label;
  return {
    headline: capLabel ? `Closest matches for ${capLabel}` : "Closest matches in the inventory",
    pathSummary: "Ranked by catalogue metadata only — review each item's description before relying on it.",
    recommendations, rejected: [], source: "metadata",
  };
}
