import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link as RouterLink } from "react-router-dom";
import { Grid, Column, Button, InlineNotification, ActionableNotification, Tile, TextInput, Link } from "@carbon/react";
import { Edit, Renew, ArrowRight, Launch } from "@carbon/icons-react";
import { streamRecommendation, fetchHealth } from "../api/client.js";
import { useCatalogue } from "../api/useCatalogue.js";
import { IntentComposer } from "../components/IntentComposer.jsx";
import { AnalysisProgress } from "../components/AnalysisProgress.jsx";
import { IntentSummary } from "../components/IntentSummary.jsx";
import { RecommendationCard } from "../components/RecommendationCard.jsx";
import { DebugPanel } from "../components/DebugPanel.jsx";

const SECTION_NOTES = { show: "Ready or nearly ready for a client conversation", learn: "Understand it before you promise it", build: "Customise or create something for this client" };
const ERROR_TITLES = {
  ai_not_configured: "AI analysis isn't configured",
  ai_auth: "The AI service rejected the server's credentials",
  ai_rate_limited: "The AI service is busy",
  ai_unreachable: "Couldn't reach the AI service",
  ai_malformed: "The AI returned something unexpected",
  ai_refused: "The AI couldn't process this request",
  network: "Connection problem",
};

export function DealAccelerator() {
  const [params, setParams] = useSearchParams();
  const debug = params.get("debug") === "1";
  const { catalogue } = useCatalogue();
  const [health, setHealth] = useState(null);
  const [draft, setDraft] = useState(params.get("q") || "");
  const [phase, setPhase] = useState("idle"); // idle | running | done | error
  const [editing, setEditing] = useState(false);
  const [run, setRun] = useState(null); // { query, mode }
  const [stages, setStages] = useState({});
  const [intent, setIntent] = useState(null);
  const [intentSource, setIntentSource] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [answer, setAnswer] = useState("");
  const controller = useRef(null);

  useEffect(() => { fetchHealth().then(setHealth).catch(() => setHealth({ ai: { configured: false }, unreachable: true })); }, []);
  useEffect(() => () => controller.current?.abort(), []);

  async function start(query, mode = "ai") {
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    setRun({ query, mode });
    setDraft(query);
    setPhase("running");
    setEditing(false);
    setStages({});
    setIntent(null);
    setResult(null);
    setError(null);
    setEvents([]);
    setAnswer("");
    const next = new URLSearchParams(params);
    next.set("q", query);
    setParams(next, { replace: true });
    try {
      const res = await streamRecommendation({
        query, mode, signal: ac.signal,
        onEvent: (event) => {
          setEvents((list) => [...list, event]);
          if (event.type === "stage") setStages((s) => ({ ...s, [event.stage]: { status: event.status, detail: event.detail } }));
          if (event.type === "intent") { setIntent(event.intent); setIntentSource(event.source); }
        },
      });
      if (ac.signal.aborted) return;
      setResult(res);
      setPhase("done");
    } catch (err) {
      if (err.name === "AbortError") return;
      setStages((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.status === "active" ? { ...v, status: "error" } : v])));
      setError(err);
      setPhase("error");
    }
  }

  const aiUnavailable = health && !health.ai?.configured;
  const showComposer = phase === "idle" || editing;
  const itemCount = result?.sections.reduce((n, s) => n + s.items.length, 0) ?? 0;

  return (
    <Grid className="page accelerator">
      <Column sm={4} md={8} lg={12}>
        <p className="eyebrow">Deal Accelerator · I know what I'm trying to accomplish</p>
        {phase === "idle" && <h1 className="page-title">What are you trying to accomplish?</h1>}
      </Column>

      {aiUnavailable && phase === "idle" && (
        <Column sm={4} md={8} lg={12}>
          <InlineNotification kind="warning" lowContrast hideCloseButton
            title={health.static ? "Static preview — AI analysis is off." : health.unreachable ? "The Activation Hub server isn't reachable." : "AI analysis isn't configured on this server."}
            subtitle={health.static ? "This GitHub Pages copy has no server, so it can't call the AI. Requests are matched by keywords against the same catalogue. Run the app locally for the full AI experience." : health.unreachable ? "Start the API server and reload." : "Set ANTHROPIC_API_KEY on the server to enable it. Until then you can run an explicitly labelled keyword match."} />
        </Column>
      )}

      {/* Request bar once a run has started */}
      {run && !editing && (
        <Column sm={4} md={8} lg={16}>
          <div className="need-bar">
            <div>
              <p className="label">Your need</p>
              <p className="need-bar__text">{run.query}</p>
            </div>
            <Button kind="ghost" size="md" renderIcon={Edit} onClick={() => { setDraft(run.query); setEditing(true); }} disabled={phase === "running"}>Edit request</Button>
          </div>
        </Column>
      )}

      {showComposer && (
        <Column sm={4} md={8} lg={12}>
          <IntentComposer value={draft} onChange={setDraft} busy={phase === "running"}
            submitLabel={editing ? "Update recommendations" : aiUnavailable ? "Find matches (keywords only)" : "Find what fits"}
            onSubmit={(q) => start(q, aiUnavailable ? "keywords" : "ai")}
            onCancel={editing ? () => setEditing(false) : null} />
        </Column>
      )}

      {(phase === "running" || phase === "error" || (phase === "done" && debug)) && (
        <Column sm={4} md={8} lg={10}>
          <AnalysisProgress stages={stages} />
        </Column>
      )}

      {intent && !editing && (
        <Column sm={4} md={8} lg={16}>
          <IntentSummary intent={intent} taxonomy={catalogue?.taxonomy} source={intentSource} />
        </Column>
      )}

      {phase === "error" && error && (
        <Column sm={4} md={8} lg={12}>
          <ActionableNotification kind="error" lowContrast hideCloseButton inline
            title={ERROR_TITLES[error.code] || "Couldn't prepare recommendations"}
            subtitle={`${error.message} Nothing was guessed — no recommendations are shown.`}
            actionButtonLabel={error.retryable !== false ? "Try again" : ""}
            onActionButtonClick={() => start(run.query, run.mode)} />
          <div className="error-actions">
            <Button kind="tertiary" size="md" renderIcon={Edit} onClick={() => setEditing(true)}>Edit request</Button>
            {run?.mode === "ai" && <Button kind="ghost" size="md" onClick={() => start(run.query, "keywords")}>Use keyword matching instead (no AI)</Button>}
            <Button kind="ghost" size="md" as={RouterLink} to="/browse">Browse all resources</Button>
          </div>
        </Column>
      )}

      {phase === "done" && result && !editing && (
        <>
          {result.explanationSource !== "ai" && itemCount > 0 && (
            <Column sm={4} md={8} lg={12}>
              <InlineNotification kind="warning" lowContrast hideCloseButton
                title={run.mode === "keywords" ? "Keyword matching — AI not used." : "AI explanations unavailable."}
                subtitle={run.mode === "keywords" ? "These results come from matching words in your request against catalogue metadata." : `${result.explanationWarning?.message ?? ""} Items are ranked by catalogue metadata only.`}
              />
              {run.mode === "ai" && <Button kind="ghost" size="sm" renderIcon={Renew} onClick={() => start(run.query, "ai")}>Retry with AI</Button>}
            </Column>
          )}

          {result.clarifyingQuestion && (
            <Column sm={4} md={8} lg={12}>
              <Tile className="clarify">
                <p className="label">One question to sharpen this</p>
                <form className="clarify__form" onSubmit={(e) => { e.preventDefault(); if (answer.trim()) start(`${run.query} ${answer.trim()}`, run.mode); }}>
                  <TextInput id="clarify" labelText={result.clarifyingQuestion} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer" />
                  <Button type="submit" size="md" renderIcon={ArrowRight} disabled={!answer.trim()}>Refine</Button>
                </form>
                {itemCount > 0 && <p className="clarify__note">Meanwhile, here are general starting points.</p>}
              </Tile>
            </Column>
          )}

          {itemCount > 0 ? (
            <>
              <Column sm={4} md={8} lg={12} className="path">
                <p className="label">Recommended path</p>
                <h2 className="path__headline">{result.headline}</h2>
                <p className="path__summary">{result.pathSummary}</p>
                {result.coverage.notes.map((n) => <p key={n} className="path__note">{n}</p>)}
              </Column>
              {result.sections.map((section) => (
                <Column key={section.key} sm={4} md={8} lg={16} className="rec-section">
                  <div className="rec-section__head">
                    <h3>{section.label}</h3>
                    <span>{SECTION_NOTES[section.key]}</span>
                  </div>
                  <div className="rec-section__grid">
                    {section.items.map((item) => <RecommendationCard key={item.id} item={item} rank={result.sections[0] === section && section.items[0] === item ? 0 : 1} />)}
                  </div>
                </Column>
              ))}
              <Column sm={4} md={8} lg={16} className="after-results">
                <Button kind="tertiary" renderIcon={Edit} onClick={() => setEditing(true)}>Refine your request</Button>
                <Button kind="ghost" as={RouterLink} to="/browse" renderIcon={ArrowRight}>Browse everything instead</Button>
              </Column>
            </>
          ) : (
            <Column sm={4} md={8} lg={10}>
              <Tile className="empty-state">
                <h2>Nothing in the inventory is a strong fit for this yet</h2>
                <p>The Activation Hub only recommends resources that exist in the AIIS inventory, and none matched what you described.</p>
                {result.coverage.notes.map((n) => <p key={n} className="path__note">{n}</p>)}
                <p className="label">What to do instead</p>
                <ul className="empty-state__list">
                  <li>Describe the client problem differently — the business process or capability often maps better than product names.</li>
                  <li>Browse the full inventory in case the need maps somewhere unexpected.</li>
                  {catalogue?.hubUrl && <li>Ask the EA Enablement Team via the current Activation Hub.</li>}
                </ul>
                <div className="empty-state__actions">
                  <Button kind="primary" size="md" renderIcon={Edit} onClick={() => setEditing(true)}>Edit request</Button>
                  <Button kind="tertiary" size="md" as={RouterLink} to="/browse">Browse everything</Button>
                  {catalogue?.hubUrl && <Link href={catalogue.hubUrl} target="_blank" rel="noopener noreferrer" renderIcon={Launch}>Current Activation Hub</Link>}
                </div>
              </Tile>
            </Column>
          )}
        </>
      )}

      {debug && (result || events.length > 0) && (
        <Column sm={4} md={8} lg={16}><DebugPanel result={result} events={events} /></Column>
      )}
    </Grid>
  );
}
