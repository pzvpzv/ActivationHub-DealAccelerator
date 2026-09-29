// Loads content/catalogue.json, validates every resource against the schema and the
// taxonomy, and caches by file mtime — so editing the JSON takes effect on the next
// request without a restart. Invalid resources are excluded (with reasons) rather than
// taking the whole catalogue down.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { sectionFor } from "./sections.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const CATALOGUE_PATH = process.env.CATALOGUE_PATH || path.resolve(here, "../../content/catalogue.json");

const Action = z.object({ label: z.string().min(1), url: z.string().min(1) });

export const ResourceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "ids are lowercase-kebab-case"),
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.string(),
  modes: z.array(z.enum(["show", "learn", "build"])).min(1),
  capabilities: z.array(z.string()).min(1),
  industries: z.array(z.string()),
  clientProblems: z.array(z.string()),
  intents: z.array(z.string()),
  clientMoments: z.array(z.string()),
  purpose: z.string().min(1),
  whatYouCanDo: z.string().min(1),
  prerequisites: z.array(z.string()),
  caveats: z.array(z.string()),
  readiness: z.string(),
  timeToValue: z.enum(["minutes", "hours", "days", "weeks"]),
  technicalLevel: z.enum(["none", "basic", "intermediate", "advanced"]),
  authoritativeSource: z.string().min(1),
  url: z.string().min(1),
  actions: z.array(Action).min(1),
  owner: z.string().nullable(),
  contact: z.object({ name: z.string(), email: z.string().nullable(), role: z.string().nullable() }).nullable(),
  status: z.enum(["live", "beta", "alpha", "coming-soon", "raw", "undocumented", "retired"]),
  lastValidated: z.string().nullable(),
  keywords: z.array(z.string()),
  provenance: z.string().min(1),
}).passthrough();

export { sectionFor };

function crossCheck(resource, taxonomy) {
  const problems = [];
  const ids = (list) => new Set(list.map((x) => x.id));
  const checks = [
    ["type", [resource.type], ids(taxonomy.types)],
    ["capabilities", resource.capabilities, ids(taxonomy.capabilities)],
    ["industries", resource.industries, ids(taxonomy.industries)],
    ["intents", resource.intents, ids(taxonomy.goals)],
    ["readiness", [resource.readiness], ids(taxonomy.readiness)],
  ];
  for (const [field, values, allowed] of checks) {
    for (const v of values) if (!allowed.has(v)) problems.push(`${field}: "${v}" is not defined in taxonomy`);
  }
  if (resource.section && !ids(taxonomy.sections).has(resource.section)) problems.push(`section: "${resource.section}" is not defined in taxonomy`);
  if (!sectionFor(resource, taxonomy)) problems.push(`section: type "${resource.type}" has no section in taxonomy`);
  return problems;
}

const EventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  dateText: z.string().min(1),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  location: z.string(),
  description: z.string(),
  audience: z.string(),
  status: z.enum(["Complete", "Confirmed", "Postponed", "Coming Soon"]),
  quarter: z.string(),
  series: z.string(),
  format: z.enum(["in-person", "virtual"]),
  resourceId: z.string().nullable(),
}).passthrough();

/** Events are occurrences, not assets: they live beside the resources and may point at one. */
export function validateEvents(raw, resourceIds) {
  const events = [];
  const issues = [];
  for (const [i, candidate] of (raw.events || []).entries()) {
    const parsed = EventSchema.safeParse(candidate);
    if (!parsed.success) {
      issues.push({ id: candidate?.id || `events[${i}]`, problems: parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`) });
      continue;
    }
    if (parsed.data.resourceId && !resourceIds.has(parsed.data.resourceId)) {
      issues.push({ id: parsed.data.id, problems: [`resourceId: "${parsed.data.resourceId}" is not a resource`] });
      continue;
    }
    events.push(parsed.data);
  }
  return { events, issues };
}

export function validateCatalogue(raw) {
  const issues = [];
  const taxonomy = raw.taxonomy;
  const resources = [];
  const seen = new Set();
  for (const [i, candidate] of (raw.resources || []).entries()) {
    const label = candidate?.id || `resources[${i}]`;
    const parsed = ResourceSchema.safeParse(candidate);
    if (!parsed.success) {
      issues.push({ id: label, problems: parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`) });
      continue;
    }
    const problems = crossCheck(parsed.data, taxonomy);
    if (seen.has(parsed.data.id)) problems.push("duplicate id");
    if (problems.length) { issues.push({ id: label, problems }); continue; }
    seen.add(parsed.data.id);
    resources.push({ ...parsed.data, section: sectionFor(parsed.data, taxonomy) });
  }
  const eventResult = validateEvents(raw, new Set(resources.map((r) => r.id)));
  issues.push(...eventResult.issues);
  return { taxonomy, resources, events: eventResult.events, announcements: raw.announcements || [], issues, hubUrl: raw.hubUrl, generatedFrom: raw.generatedFrom };
}

let cache = { mtimeMs: -1, value: null };

export function getCatalogue() {
  const { mtimeMs } = fs.statSync(CATALOGUE_PATH);
  if (cache.value && cache.mtimeMs === mtimeMs) return cache.value;
  const raw = JSON.parse(fs.readFileSync(CATALOGUE_PATH, "utf8"));
  const value = validateCatalogue(raw);
  value.byId = new Map(value.resources.map((r) => [r.id, r]));
  cache = { mtimeMs, value };
  if (value.issues.length) console.warn(`[catalogue] ${value.issues.length} resource(s) excluded — run npm run validate:content`);
  return value;
}
