// Validates content/catalogue.json. Run after editing content: npm run validate:content
import { getCatalogue, CATALOGUE_PATH } from "../server/catalogue/load.js";

const { resources, issues, taxonomy } = getCatalogue();
console.log(`${CATALOGUE_PATH}\n${resources.length} valid resources · ${taxonomy.capabilities.length} capabilities · ${taxonomy.industries.length} industries`);
const byType = Object.fromEntries(taxonomy.types.map((t) => [t.id, resources.filter((r) => r.type === t.id).length]));
console.log("By type:", byType);
if (issues.length) {
  console.error(`\n${issues.length} resource(s) will be EXCLUDED until fixed:`);
  for (const i of issues) console.error(` - ${i.id}\n     ${i.problems.join("\n     ")}`);
  process.exit(1);
}
const unused = taxonomy.capabilities.filter((c) => !resources.some((r) => r.capabilities.includes(c.id)));
if (unused.length) console.log("Capabilities with no resources:", unused.map((c) => c.id).join(", "));
console.log("OK");
