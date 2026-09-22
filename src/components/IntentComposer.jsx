import { TextArea, Button } from "@carbon/react";
import { ArrowRight } from "@carbon/icons-react";

const EXAMPLES = [
  "I need a Finance Transformation demo for a banking client.",
  "The client meeting is tomorrow. I need something ready to show.",
  "I need help creating a proposal.",
  "I want something I can customise for my client.",
  "I need to understand Process Studio before a client workshop.",
];

export function IntentComposer({ value, onChange, onSubmit, busy, submitLabel = "Find what fits", onCancel }) {
  const submit = (e) => { e.preventDefault(); if (value.trim().length >= 3 && !busy) onSubmit(value.trim()); };
  return (
    <form className="composer" onSubmit={submit}>
      <TextArea
        id="intent"
        labelText="Describe your client need"
        helperText="Describe the client situation in your own words — the industry, what you need and when, if you know."
        placeholder="Describe what you need for your client…"
        rows={3}
        value={value}
        maxCount={1000}
        enableCounter
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e); }}
      />
      <div className="composer__row">
        <div className="composer__examples" aria-label="Example requests">
          <span className="label">Try</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="example-chip" onClick={() => onChange(ex)}>{ex}</button>
          ))}
        </div>
        <div className="composer__submit">
          {onCancel && <Button kind="ghost" onClick={onCancel}>Cancel</Button>}
          <Button type="submit" renderIcon={ArrowRight} disabled={busy || value.trim().length < 3}>{submitLabel}</Button>
        </div>
      </div>
    </form>
  );
}
