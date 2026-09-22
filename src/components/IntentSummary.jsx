import { Tag } from "@carbon/react";
import { labelFor } from "../api/useCatalogue.js";

const HORIZON = { immediate: "Today or tomorrow", this_week: "This week", later: "Later", unspecified: null };
const PREFERENCE = { ready_to_use: "Ready to use", customisable: "Customisable", no_preference: null };

/** "Here's what I understood" — the structured interpretation, in plain language. */
export function IntentSummary({ intent, taxonomy, source }) {
  if (!intent || !taxonomy) return null;
  const rows = [
    ["Goal", intent.goal ? labelFor(taxonomy.goals, intent.goal) : null],
    ["Client", intent.client],
    ["Industry", intent.industry ? labelFor(taxonomy.industries, intent.industry) : intent.industryMentioned],
    ["Business problem", intent.businessProblem],
    ["Topics", intent.capabilities?.length ? intent.capabilities.map((c) => labelFor(taxonomy.capabilities, c)) : null],
    ["Looking for", intent.assetNeed?.length ? intent.assetNeed : null],
    ["Timing", intent.urgency || HORIZON[intent.timeHorizon]],
    ["Preference", PREFERENCE[intent.preference]],
    ["Constraints", intent.constraints?.length ? intent.constraints.join("; ") : null],
  ].filter(([, v]) => v && (!Array.isArray(v) || v.length));

  return (
    <section className="understood" aria-label="What the hub understood">
      <p className="label">{source === "keywords" ? "Keyword reading of your request (AI not used)" : "Here's what I understood — edit your request if I got it wrong"}</p>
      <dl className="understood__grid">
        {rows.map(([label, value]) => (
          <div key={label} className="understood__item">
            <dt>{label}</dt>
            <dd>{Array.isArray(value) ? value.map((v) => <Tag key={v} size="sm" type="gray">{v}</Tag>) : value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
