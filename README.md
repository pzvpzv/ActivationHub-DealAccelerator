# AIIS Activation Hub — Deal Accelerator prototype

A working prototype that tests one product hypothesis:

> Can AIIS Activation understand what someone is trying to accomplish and get them to the right existing AIIS resource or accelerator, without them needing to know the internal AIIS landscape?

It offers two ways in, and both use **one shared catalogue**:

| Entry | For | What happens |
|---|---|---|
| **Deal Accelerator** (`/accelerator`) | "I know what I'm trying to accomplish." | A natural-language request → AI interpretation → deterministic retrieval and ranking over the catalogue → AI-ordered, explained recommendations → links to the authoritative source. |
| **Browse resources** (`/browse`) | "I know what I'm looking for." | Search, plus filters by Show / Learn / Build, type, capability and industry. |

Built with IBM Carbon Design System v11 (`@carbon/react`).

---

## Run it locally

Requirements: Node.js 20+.

```bash
npm install
```

```bash
cp .env.example .env
```

Then edit `.env` and set `ANTHROPIC_API_KEY`. Start the app:

```bash
npm run dev
```

- App: http://localhost:5173 (Vite; `/api` is proxied to the API server)
- API: http://localhost:8787
- Debug trace: add `?debug=1` to the Deal Accelerator URL, e.g. `http://localhost:5173/accelerator?debug=1`

For a production-style single process, build the app and then start the server. The server serves `dist/`:

```bash
npm run build
```

```bash
npm start
```

Other scripts:

```bash
npm test
```

```bash
npm run validate:content
```

### Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes, for AI analysis | — | Read by the server only. It is never sent to the browser. |
| `AI_MODEL` | No | `claude-opus-5` | Model used for interpretation and explanation. |
| `AI_EFFORT` | No | `low` | Reasoning effort (`low` keeps the live demo responsive). |
| `PORT` | No | `8787` | API server port. |
| `CATALOGUE_PATH` | No | `content/catalogue.json` | Alternative catalogue file. |

Without a key, the Deal Accelerator says AI isn't configured. It offers a keyword match that is **clearly labelled** as not using AI. It never silently substitutes fake analysis.

---

## Architecture

```
Browser (React + Carbon)                     Node server (Express)
─────────────────────────                    ─────────────────────────────────────────────
/accelerator ── POST /api/recommend ───────▶ services/recommend.js (orchestrator, streams NDJSON)
   ▲  stage events as they really happen        │
   │                                            ├─ 1. services/intent.js      AI → structured intent,
   │                                            │                             constrained to the taxonomy
   │                                            ├─    services/vocabulary.js  deterministic backstop
   │                                            ├─ 2. services/ranking.js     pure scoring + shortlist + coverage notes
   │                                            ├─ 3. services/explain.js     AI orders the shortlist and writes "why";
   │                                            │                             ids limited to the shortlist
   │                                            └─ ai/anthropic.js            provider integration (server-only key)
/browse ────── GET /api/catalogue ─────────▶ catalogue/load.js  validates content/catalogue.json (reloads on edit)
```

**The loop:** intent → interpretation → matching → recommendation → authoritative link.

1. **Understand (AI).** The request becomes JSON: `goal`, `client`, `industry`, `businessProblem`, `capabilities`, `assetNeed`, `urgency`, `timeHorizon`, `preference`, `constraints`, `searchConcepts`, `clarifyingQuestion`. Enum fields are generated from the catalogue taxonomy, so the model can only choose values the catalogue uses. The prompt forbids inventing details and forbids recommending anything at this step.
2. **Retrieve and rank (deterministic).** Every resource is scored with named signals. Weights are in `WEIGHTS` in `server/services/ranking.js`:
   - capability match
   - industry match or mismatch
   - goal match
   - asset type
   - search concepts found in the text
   - urgency and readiness (e.g. "tomorrow" boosts ready-to-use items and penalises builds)
   - customisation preference
   - status (e.g. coming soon)

   The shortlist is capped per type and always includes the best items for each of Show / Learn / Build. Coverage notes state what the inventory *doesn't* have, for example "Nothing in the inventory mentions 'google partnership'".
3. **Explain (AI).** The model sees only the shortlist and its metadata. It picks 3–6 items, assigns Show it / Learn it / Build it, and writes a grounded "why this fits". The output schema only allows shortlist IDs, and the server checks them again. If this step fails, the server falls back to metadata ranking, and the UI says so.

Nothing in the UI is hard-coded to a query. Different requests produce different shortlists because the scoring is driven by the interpreted intent and the catalogue metadata.

### States handled

- Real progress per stage (not timers)
- AI not configured
- AI auth, rate-limit, unreachable, refused and malformed responses, each with retry, edit-request and keyword options
- Explanation-only failure (degraded, labelled)
- Partial match with coverage notes
- No match (empty state with next steps)
- One clarifying question for very open requests
- External links: every action opens the source in a new tab and names the destination. **Copy link** is there for intranet links the browser can't open.

---

## Deploying

| Where | What runs | AI |
|---|---|---|
| **Render** (`render.yaml`) | Full app: UI plus Node API, from one URL | Yes. The key is stored as a Render secret. |
| **GitHub Pages** (`.github/workflows/pages.yml`) | Static preview: Browse, plus the Deal Accelerator in keyword mode | No. A static site can't keep a key secret. |

**Render setup (one-off):**

1. Go to dashboard.render.com and choose **New → Blueprint**. Connect GitHub and pick this repo.
2. When prompted, paste your Anthropic key into `ANTHROPIC_API_KEY`, then choose **Apply**.
3. Render builds with `npm ci --include=dev && npm run build` and starts with `npm start`. It then redeploys on every push to `main`.

The blueprint uses the free plan, which sleeps after about 15 minutes idle and takes about a minute to wake. Before a live demo, open the URL a few minutes early, or switch the service to **Starter** in the Render dashboard.

The Render URL has **no access protection**. Anyone with the link can run AI requests on your key, so keep the link to the people you demo to, and set a monthly spend limit in the Anthropic Console.

---

## Updating content (no code changes)

Everything a user sees comes from **`content/catalogue.json`**:

- `taxonomy`: goals, capabilities (with synonyms), industries, types, readiness levels
- `resources`: one object per resource

To add a resource:

1. Append an object to `resources`. Copy a similar one and keep `id` unique, in kebab-case.
2. Use only capability, industry, type and readiness IDs that exist in `taxonomy`. Add a new capability to the taxonomy first if you need one.
3. Run `npm run validate:content`.

The running server picks up the change on the next request. The resource then appears in Browse and becomes eligible for Deal Accelerator recommendations; `test/ranking.test.js` includes a test proving this.

Invalid resources are **excluded with a reason** rather than breaking the hub.

Key fields:

| Field | Drives |
|---|---|
| `capabilities`, `industries`, `clientProblems`, `keywords` | Matching |
| `intents` | Goal match (demonstrate, prepare_conversation, learn, build_customise, propose, find_event) |
| `modes` | Show it / Learn it / Build it grouping |
| `readiness`, `timeToValue` | Urgency ranking |
| `purpose`, `whatYouCanDo`, `prerequisites`, `caveats` | Card content ("Best for", "What you can do", "Before you start") |
| `actions`, `authoritativeSource` | Where the user goes next |
| `status` | `live`, `beta`, `alpha`, `coming-soon`, `raw`, `undocumented` or `retired` |
| `provenance`, `lastValidated` | Where the entry came from and when a person last checked it |

### Where the current content came from

The 93 resources were seeded from two sources:

- **Activation Hub [TEST] export (16 Sep 2026):** recordings, courses, events, campaigns, tools, guides, labs and links, with their real URLs.
- **`ea-agentic-app-templates` README (saved 3 Sep 2026):** 8 app folders, their conversion state, agent models, prerequisites, ports and walkthrough decks.

Classification metadata was added by hand during seeding: capabilities, intents, modes, readiness and time-to-value. It should be reviewed by the content owners. `lastValidated` is `null` everywhere, because no one has checked these links from inside the IBM network yet.

---

## Verified live (16 Sep 2026, `claude-opus-5`)

| Request | Result |
|---|---|
| I need a Finance Transformation demo for a banking client. | Show: FP&A and reconciliation walkthrough decks, plus the Finance campaign. Build: FP&A template; Lending template (flagged as banking-specific but not Finance Transformation); template portfolio. |
| …The client meeting is tomorrow. I need something ready to show. | Four ready-to-use items lead. The template is explicitly deferred until after the meeting. |
| I need help creating a proposal. | Proposal Generator first, then approved collateral, plus one clarifying question. |
| I need a proposal for a banking opportunity. | Banking-targeted growth campaign, then Proposal Generator, Resource Library and How to sell EA. |
| I need to build a demo. | Demo Factory, then the templates to convert. |
| Show me something about Process Studio. | Launch video, how-to recording, user guide, guided lab, then the platform. |
| I want to learn about the Google partnership. | States that nothing covers it; the AI Adoption Lab is the only resource that mentions Google. |
| I need something for a client conversation about application modernisation. | States there is no modernisation deck; offers Agentic PDLC enablement instead. |
| I need an agentic demo for finance. | Finance decks and templates, plus a clarifying question about which process. |
| I want something ready to show tomorrow. / …customise for my client. | No topic named, so it gives general starting points (ready-to-use vs customisable), labelled as such, with a clarifying question. |

## Known limitations

- **Links not verified.** Every URL comes from the source material, but intranet destinations (w3, SharePoint, Box, github.ibm.com) can't be reached from outside IBM. The supply-chain campaign link was reconstructed (the test export pointed at localhost) and is marked in its `caveats`. The Hub base URL (`pages.github.ibm.com/.../ea-learning/`) is derived from the Process Studio guide link.
- **Latency.** A request takes about 13–20 s with `claude-opus-5` at low effort: roughly 4–7 s to understand and 8–12 s to explain. Progress is shown per stage. Setting `AI_MODEL=claude-sonnet-5` should be faster but hasn't been evaluated.
- **Deck links go to the template folder,** not the individual `.html` file, because the README doesn't give exact file paths.
- **P2P Dispute Resolution** exists as a folder but isn't documented in the portfolio README. It is marked `undocumented`, and the prototype's earlier claims about it were not carried over.
- **Curated metadata is a first pass.** Ranking quality depends on it.
- **No auth, analytics or persistence.** Requests aren't stored. Error logs record the error code, never the request text.
- **English only;** tuned on a small set of queries.
- **Courses and events** link to the Activation Hub curriculum for registration, because the export has no per-course registration URL.

## What productionising would take

1. **Content operations.** An owner and review workflow for `catalogue.json`, either a PR-based flow with `validate:content` in CI or a lightweight headless CMS. Add a scheduled link checker running inside the IBM network that updates `lastValidated`.
2. **Hosting with a server component.** The LLM call needs a secret, so this can't be purely GitHub Pages. Options include IBM Cloud Code Engine, an internal Kubernetes or OpenShift namespace, or a serverless function hosting `server/`.
3. **SSO** (w3id) in front of the app. It is internal content.
4. **Approved AI provider.** Confirm that Anthropic via API is approved for this data, or add a watsonx.ai provider behind `server/ai/`. The interface is one function, `structuredCall`.
5. **An evaluation set.** 30–50 real practitioner requests with expected resources, run in CI against ranking changes and prompt changes.
6. **Telemetry.** Which recommendations get clicked, and which requests find no match, to prioritise new content.
7. **Scale.** Beyond a few hundred resources, add embedding-based retrieval as a *candidate generator* in front of the same deterministic scoring. It isn't needed at the current size.

## Specific engineering dependencies

- A place to run a small Node service with a secret (hosting plus SSO).
- AI provider approval and a key (or watsonx.ai credentials).
- Network access from a CI job to validate intranet links.

Everything else, including content changes and weight tuning, can be done without an engineer.
