import { Accordion, AccordionItem, CodeSnippet } from "@carbon/react";

/** Development-only view of the pipeline: query → intent → candidates → ranking → final. Enabled with ?debug=1. */
export function DebugPanel({ result, events }) {
  const d = result?.debug;
  return (
    <section className="debug" aria-label="Debug">
      <h2 className="debug__title">Debug — pipeline trace</h2>
      <Accordion align="start" size="sm">
        <AccordionItem title="1 · Raw query & run info" open>
          <CodeSnippet type="multi" feedback="Copied">{JSON.stringify({ query: d?.query, mode: d?.mode, model: d?.model, catalogueSize: d?.catalogueSize, catalogueIssues: d?.catalogueIssues, timings: d?.timings }, null, 2)}</CodeSnippet>
        </AccordionItem>
        <AccordionItem title={`2 · Interpreted intent (${d?.intentSource ?? "—"})`}>
          <p className="debug__note">AI output as returned:</p>
          <CodeSnippet type="multi" feedback="Copied">{JSON.stringify(d?.rawIntent, null, 2)}</CodeSnippet>
          <p className="debug__note">Deterministic vocabulary backstop added: {JSON.stringify(d?.effectiveIntent?.backstop)}</p>
        </AccordionItem>
        <AccordionItem title={`3 · Candidates & ranking (${d?.candidates?.length ?? 0} shortlisted of ${d?.totalMatched ?? 0} matched)`}>
          <table className="debug__table">
            <thead><tr><th>#</th><th>Score</th><th>Resource</th><th>Signals</th></tr></thead>
            <tbody>
              {d?.candidates?.map((c, i) => (
                <tr key={c.id}>
                  <td>{i + 1}</td><td>{c.score}</td>
                  <td><strong>{c.title}</strong><br /><code>{c.id}</code> · {c.type}</td>
                  <td>{c.signals.map((s) => `${s.kind} (${s.detail}) ${s.points > 0 ? "+" : ""}${s.points}`).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="debug__note">Coverage: {JSON.stringify(d?.coverage)}</p>
        </AccordionItem>
        <AccordionItem title={`4 · Final recommendations (${d?.explanation?.source ?? "—"})`}>
          <CodeSnippet type="multi" feedback="Copied">{JSON.stringify(d?.explanation, null, 2)}</CodeSnippet>
        </AccordionItem>
        <AccordionItem title={`Stream events (${events.length})`}>
          <CodeSnippet type="multi" feedback="Copied">{events.map((e) => JSON.stringify(e)).join("\n")}</CodeSnippet>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
