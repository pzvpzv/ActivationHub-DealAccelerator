import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Grid, Column, Tile, ClickableTile, Button, Tag, Link, SkeletonText } from "@carbon/react";
import { ArrowRight, Launch, Calendar, Play } from "@carbon/icons-react";
import { useCatalogue } from "../api/useCatalogue.js";

const KIND_TAG = { launch: ["Now live", "green"], beta: ["Beta", "cyan"], alpha: ["Alpha", "cyan"], campaign: ["Campaign", "blue"], notice: ["Notice", "warm-gray"] };
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const fmt = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** "Aug 2026" / "Q1 2026" → a sortable number, so the newest recordings surface without hand-picking. */
function recencyOf(date) {
  if (!date) return 0;
  const year = Number(date.match(/\d{4}/)?.[0] ?? 0);
  const month = MONTHS.indexOf(date.slice(0, 3).toLowerCase());
  const quarter = date.match(/Q(\d)/)?.[1];
  return year * 12 + (month >= 0 ? month : quarter ? (Number(quarter) - 1) * 3 : 0);
}

export function Home() {
  const { catalogue, loading } = useCatalogue();
  const today = new Date().toISOString().slice(0, 10);

  const upcoming = useMemo(() => {
    if (!catalogue) return [];
    return catalogue.resources
      .flatMap((r) => (r.sessions || []).filter((s) => s.start && s.start >= today).map((s) => ({ ...s, resource: r })))
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 4);
  }, [catalogue, today]);

  const latestRecordings = useMemo(() => {
    if (!catalogue) return [];
    return catalogue.resources
      .filter((r) => r.type === "recording" && r.date)
      .sort((a, b) => recencyOf(b.date) - recencyOf(a.date) || a.title.localeCompare(b.title))
      .slice(0, 3);
  }, [catalogue]);

  const announcements = catalogue?.announcements?.slice().sort((a, b) => b.date.localeCompare(a.date)) ?? [];
  const [lead, ...rest] = announcements;

  return (
    <Grid className="page home">
      <Column sm={4} md={8} lg={12}>
        <p className="eyebrow">IBM Consulting · AI Integration Services</p>
        <h1 className="page-title">Activation Hub</h1>
        <p className="page-lede">Everything AIIS has published to help you with a client — demos, accelerators, recordings, guides, training and campaign material. Find it by section, or describe what you're trying to accomplish.</p>
      </Column>

      {loading && <Column sm={4} md={8} lg={12}><SkeletonText paragraph lineCount={5} /></Column>}

      {/* What's happening — the hub as a noticeboard, not a directory */}
      {lead && (
        <Column sm={4} md={8} lg={10} className="home-lead">
          <Tile className="ann ann--lead">
            <div className="ann__head">
              <Tag size="sm" type={KIND_TAG[lead.kind]?.[1] || "gray"}>{KIND_TAG[lead.kind]?.[0] || lead.kind}</Tag>
              <span className="ann__date">{fmt(lead.date)}</span>
            </div>
            <h2 className="ann__title">{lead.title}</h2>
            <p className="ann__body">{lead.body}</p>
            <Button size="md" href={lead.action.url} target="_blank" rel="noopener noreferrer" renderIcon={Launch}>{lead.action.label}</Button>
          </Tile>
        </Column>
      )}

      {upcoming.length > 0 && (
        <Column sm={4} md={8} lg={6} className="home-side">
          <div className="panel">
            <h2 className="panel__title"><Calendar size={16} /> Next up</h2>
            <ul className="events">
              {upcoming.map((s) => (
                <li key={`${s.resource.id}-${s.start}`} className="event">
                  <span className="event__date">{fmt(s.start)}</span>
                  <span className="event__body">
                    <RouterLink to={`/browse?section=training&q=${encodeURIComponent(s.resource.title)}`}>{s.resource.title}</RouterLink>
                    <span className="event__meta">{s.location} · {s.date}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="panel__note">Registration flow to be confirmed — placeholder.</p>
            <Link as={RouterLink} to="/browse?section=training">See training &amp; calendar</Link>
          </div>
        </Column>
      )}

      {rest.length > 0 && (
        <Column sm={4} md={8} lg={16} className="home-block">
          <h2 className="block__title">Also new</h2>
          <div className="ann-grid">
            {rest.map((a) => (
              <Tile key={a.id} className="ann">
                <div className="ann__head">
                  <Tag size="sm" type={KIND_TAG[a.kind]?.[1] || "gray"}>{KIND_TAG[a.kind]?.[0] || a.kind}</Tag>
                  <span className="ann__date">{fmt(a.date)}</span>
                </div>
                <h3 className="ann__title ann__title--sm">{a.title}</h3>
                <p className="ann__body">{a.body}</p>
                <Link href={a.action.url} target="_blank" rel="noopener noreferrer" renderIcon={Launch}>{a.action.label}</Link>
              </Tile>
            ))}
          </div>
        </Column>
      )}

      {latestRecordings.length > 0 && (
        <Column sm={4} md={8} lg={16} className="home-block">
          <h2 className="block__title">Latest recordings</h2>
          <div className="ann-grid">
            {latestRecordings.map((r) => (
              <Tile key={r.id} className="ann">
                <div className="ann__head">
                  <Tag size="sm" type="teal">Recording</Tag>
                  <span className="ann__date">{r.date}{r.duration ? ` · ${r.duration}` : ""}</span>
                </div>
                <h3 className="ann__title ann__title--sm">{r.title}</h3>
                <p className="ann__body">{r.description}</p>
                <Link href={r.actions[0].url} target="_blank" rel="noopener noreferrer" renderIcon={Play}>Watch</Link>
              </Tile>
            ))}
          </div>
          <Link as={RouterLink} to="/browse?section=video-library">Open the video library</Link>
        </Column>
      )}

      {catalogue && (
        <Column sm={4} md={8} lg={16} className="home-block">
          <h2 className="block__title">Browse by section</h2>
          <div className="section-grid">
            {catalogue.taxonomy.sections.map((s) => {
              const n = catalogue.resources.filter((r) => r.section === s.id).length;
              return (
                <ClickableTile key={s.id} as={RouterLink} to={`/browse?section=${s.id}`} className="section-chip">
                  <span className="section-chip__label">{s.label}</span>
                  <span className="section-chip__count">{n}</span>
                </ClickableTile>
              );
            })}
          </div>
        </Column>
      )}

      <Column sm={4} md={8} lg={10} className="home-block">
        <Tile className="promo">
          <Tag size="sm" type="blue">Preview</Tag>
          <h2 className="ann__title ann__title--sm">Not sure which resource you need?</h2>
          <p className="ann__body">The Deal Accelerator takes a client need in your own words and recommends a path through what AIIS already has. In preview — not yet the supported way in.</p>
          <Button kind="tertiary" size="md" as={RouterLink} to="/accelerator" renderIcon={ArrowRight}>Try the Deal Accelerator</Button>
        </Tile>
      </Column>
    </Grid>
  );
}
