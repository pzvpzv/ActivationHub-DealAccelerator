import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCatalogue } from "../server/catalogue/load.js";
import { effectiveIntent, rankCatalogue, assessCoverage, scoreResource } from "../server/services/ranking.js";
import { interpretWithoutAI } from "../server/services/intent.js";
import fs from "node:fs";

const raw = JSON.parse(fs.readFileSync(new URL("../content/catalogue.json", import.meta.url)));
const catalogue = validateCatalogue(raw);
catalogue.byId = new Map(catalogue.resources.map((r) => [r.id, r]));

const base = { goalSummary: "", client: null, industry: null, industryMentioned: null, businessProblem: null, capability: null, capabilities: [], assetNeed: [], urgency: null, timeHorizon: "unspecified", preference: "no_preference", constraints: [], searchConcepts: [], clarifyingQuestion: null };
const rank = (query, intent) => {
  const eff = effectiveIntent(query, { ...base, ...intent }, catalogue.taxonomy);
  const ranked = rankCatalogue(eff, catalogue);
  return { eff, ranked, ids: ranked.candidates.map((c) => c.id), coverage: assessCoverage(eff, ranked, catalogue, query) };
};

// Intents below are shaped like the AI interpreter's output for each query.
const financeDemo = { goal: "demonstrate", industry: "banking-financial-services", capabilities: ["finance-transformation"], assetNeed: ["demo", "walkthrough", "template"], searchConcepts: ["finance transformation", "banking", "demo"] };

test("catalogue validates with no excluded resources", () => {
  assert.deepEqual(catalogue.issues, []);
  assert.ok(catalogue.resources.length > 50);
});

test("invalid resources are excluded with reasons, not fatal", () => {
  const broken = { ...raw, resources: [...raw.resources.slice(0, 2), { ...raw.resources[0], id: "bad-one", capabilities: ["not-a-capability"] }] };
  const result = validateCatalogue(broken);
  assert.equal(result.resources.length, 2);
  assert.match(result.issues[0].problems[0], /not-a-capability/);
});

test("golden scenario: finance transformation demo for banking returns show, build and accelerator options", () => {
  const { ids } = rank("I need a Finance Transformation demo for a banking client.", financeDemo);
  assert.ok(ids.some((id) => id.startsWith("deck-")), "a ready-to-show walkthrough deck");
  assert.ok(ids.includes("tpl-finance-fpa"), "a finance template to customise");
  assert.ok(ids.includes("demo-factory"), "Demo Factory accelerator");
  ids.forEach((id) => assert.ok(catalogue.byId.has(id), `${id} exists`));
});

test("urgency: 'tomorrow, ready to show' promotes ready-to-use items above templates", () => {
  const { ranked } = rank("The client meeting is tomorrow. I need something ready to show.", { ...financeDemo, timeHorizon: "immediate", preference: "ready_to_use" });
  const top = ranked.candidates.slice(0, 3).map((c) => catalogue.byId.get(c.id));
  top.forEach((r) => assert.equal(r.readiness, "ready-to-use", `${r.id} should be ready to use`));
  const relaxed = rank("I need a Finance Transformation demo for a banking client.", financeDemo);
  assert.notDeepEqual(ranked.candidates.slice(0, 3).map((c) => c.id), relaxed.ranked.candidates.slice(0, 3).map((c) => c.id));
});

test("customise preference promotes templates", () => {
  const { ranked } = rank("I want something I can customise for my client", { goal: "build_customise", capabilities: ["demo-building"], assetNeed: ["template"], preference: "customisable", searchConcepts: ["customise", "template"] });
  assert.equal(catalogue.byId.get(ranked.candidates[0].id).readiness, "customise");
});

test("proposal request leads with the Proposal Generator", () => {
  const { ids } = rank("I need help creating a proposal.", { goal: "propose", capabilities: ["selling-positioning"], assetNeed: ["proposal"], searchConcepts: ["proposal"] });
  assert.equal(ids[0], "proposal-generator");
});

test("different queries produce different shortlists", () => {
  const a = rank("q", financeDemo).ids;
  const b = rank("q", { goal: "learn", capabilities: ["process-studio"], assetNeed: ["recording"], searchConcepts: ["process studio"] }).ids;
  assert.equal(a.filter((id) => b.includes(id)).length, 0);
});

test("unsupported topics are reported honestly", () => {
  const { coverage } = rank("I want to learn about the Google partnership.", { goal: "learn", capabilities: ["partner-ecosystem"], searchConcepts: ["google partnership"] });
  assert.ok(coverage.notes.some((n) => n.includes("google partnership")));
  const none = rank("quarterly office party catering", { searchConcepts: ["office party", "catering"] });
  assert.equal(none.ranked.candidates.length, 0);
  assert.equal(none.coverage.quality, "none");
});

test("coming-soon resources are penalised", () => {
  const r = catalogue.byId.get("campaign-procurement");
  const s = scoreResource(r, { ...base, capabilities: ["procure-to-pay"] }, catalogue.taxonomy);
  assert.ok(s.signals.some((x) => x.kind === "status" && x.points < 0));
});

test("keyword interpretation reads industry, capability and urgency", () => {
  const { intent } = interpretWithoutAI("Finance demo for a bank, meeting tomorrow", catalogue.taxonomy);
  assert.equal(intent.industry, "banking-financial-services");
  assert.ok(intent.capabilities.includes("finance-transformation"));
  assert.equal(intent.timeHorizon, "immediate");
});

test("adding a resource with metadata makes it discoverable without code changes", () => {
  const added = { ...raw.resources.find((r) => r.id === "demo-factory"), id: "new-banking-demo-kit", title: "Banking demo kit", industries: ["banking-financial-services"], capabilities: ["finance-transformation", "demo-building"] };
  const extended = validateCatalogue({ ...raw, resources: [...raw.resources, added] });
  extended.byId = new Map(extended.resources.map((r) => [r.id, r]));
  const eff = effectiveIntent("q", { ...base, ...financeDemo }, extended.taxonomy);
  assert.ok(rankCatalogue(eff, extended).candidates.some((c) => c.id === "new-banking-demo-kit"));
});

test("purpose without topic: 'ready to show tomorrow' returns ready-to-use starting points, labelled partial", () => {
  const { ranked, coverage } = rank("I want something ready to show tomorrow.", { timeHorizon: "immediate", preference: "ready_to_use" });
  assert.equal(ranked.basis, "purpose");
  assert.ok(ranked.candidates.length > 0);
  assert.equal(catalogue.byId.get(ranked.candidates[0].id).readiness, "ready-to-use");
  assert.equal(coverage.quality, "partial");
  const custom = rank("I want something I can customise for my client.", { preference: "customisable" });
  assert.equal(catalogue.byId.get(custom.ranked.candidates[0].id).readiness, "customise");
});
