import { Tag } from "@carbon/react";

const TYPE_COLOURS = { accelerator: "purple", template: "purple", platform: "purple", "walkthrough-deck": "blue", collateral: "cool-gray", campaign: "blue", recording: "teal", guide: "cyan", lab: "magenta", course: "magenta", event: "magenta", community: "warm-gray" };
const STATUS = { beta: ["Beta", "cyan"], alpha: ["Alpha", "cyan"], "coming-soon": ["Coming soon", "warm-gray"], raw: ["Not templatized", "red"], undocumented: ["Undocumented", "red"] };
const READINESS_COLOURS = { "ready-to-use": "green", attend: "gray", customise: "outline", build: "red" };

export function ResourceTags({ type, typeLabel, readiness, readinessLabel, status }) {
  return (
    <div className="resource-tags">
      <Tag size="sm" type={TYPE_COLOURS[type] || "gray"}>{typeLabel}</Tag>
      {readinessLabel && <Tag size="sm" type={READINESS_COLOURS[readiness] || "gray"}>{readinessLabel}</Tag>}
      {STATUS[status] && <Tag size="sm" type={STATUS[status][1]}>{STATUS[status][0]}</Tag>}
    </div>
  );
}
