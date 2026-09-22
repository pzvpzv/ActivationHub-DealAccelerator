import { InlineLoading } from "@carbon/react";
import { CheckmarkFilled, ErrorFilled, WarningAltFilled, CircleDash } from "@carbon/icons-react";

export const STAGES = [
  { key: "understand", label: "Understanding your request" },
  { key: "retrieve", label: "Finding and ranking relevant AIIS resources and accelerators" },
  { key: "explain", label: "Preparing your recommendations" },
];

/** Each row reflects a real server stage event — nothing here is on a timer. */
export function AnalysisProgress({ stages }) {
  return (
    <ol className="progress" aria-live="polite">
      {STAGES.map(({ key, label }) => {
        const s = stages[key] || { status: "pending" };
        return (
          <li key={key} className={`progress__row progress__row--${s.status}`}>
            {s.status === "active" ? <InlineLoading description={`${label}…`} /> : (
              <>
                {s.status === "done" && <CheckmarkFilled className="icon-success" />}
                {s.status === "error" && <ErrorFilled className="icon-error" />}
                {s.status === "degraded" && <WarningAltFilled className="icon-warning" />}
                {(s.status === "pending" || s.status === "skipped") && <CircleDash className="icon-muted" />}
                <span>{label}{s.detail ? ` — ${s.detail}` : ""}{s.status === "skipped" ? " — skipped" : ""}</span>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
