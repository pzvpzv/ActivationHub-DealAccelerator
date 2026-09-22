// Loads content/catalogue.json, validates every resource against the schema and the
// taxonomy, and caches by file mtime — so editing the JSON takes effect on the next
// request without a restart. Invalid resources are excluded (with reasons) rather than
// taking the whole catalogue down.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

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
  return problems;
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
    resources.push(parsed.data);
  }
  return { taxonomy, resources, issues, hubUrl: raw.hubUrl, generatedFrom: raw.generatedFrom };
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
