import { useMemo } from "react";
import { useSearchParams, Link as RouterLink } from "react-router-dom";
import { Grid, Column, Search, Dropdown, ContentSwitcher, Switch, Tile, ClickableTile, Button, InlineNotification, SkeletonText, Link, Tag } from "@carbon/react";
import { ArrowRight, ArrowLeft } from "@carbon/icons-react";
import { useCatalogue, labelFor } from "../api/useCatalogue.js";
import { ResourceTags } from "../components/ResourceTags.jsx";
import { ResourceActions } from "../components/ResourceActions.jsx";

const MODES = [
  { id: "all", label: "All" },
  { id: "show", label: "Show it" },
  { id: "learn", label: "Learn it" },
  { id: "build", label: "Build it" },
];

function matchesText(resource, q) {
  if (!q) return true;
  const text = [resource.title, resource.description, resource.purpose, ...resource.keywords, ...resource.clientProblems].join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((word) => text.includes(word));
}

export function Browse() {
  const { catalogue, error, loading } = useCatalogue();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const section = params.get("section") || "";
  const mode = params.get("mode") || "all";
  const type = params.get("type") || "all";
  const capability = params.get("capability") || "all";
  const industry = params.get("industry") || "all";

  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key); else next.set(key, value);
    if (key === "section") { next.delete("type"); next.delete("capability"); next.delete("industry"); }
    setParams(next, { replace: true });
  };

  // The landing view is the structure itself; searching or picking a section opens the list.
  const listView = Boolean(section || q);

  const inSection = useMemo(
    () => (catalogue && section ? catalogue.resources.filter((r) => r.section === section) : catalogue?.resources ?? []),
    [catalogue, section]
  );
  const filtered = useMemo(
    () => inSection.filter((r) =>
      matchesText(r, q) &&
      (mode === "all" || r.modes.includes(mode)) &&
      (type === "all" || r.type === type) &&
      (capability === "all" || r.capabilities.includes(capability)) &&
      (industry === "all" || r.industries.includes(industry))
    ),
    [inSection, q, mode, type, capability, industry]
  );

  if (error) return <Grid className="page"><Column sm={4} md={8} lg={12}><InlineNotification kind="error" title="Couldn't load the resource inventory" subtitle={error.message} hideCloseButton /></Column></Grid>;

  const { taxonomy } = catalogue || {};
  const sectionMeta = taxonomy?.sections.find((s) => s.id === section);
  const count = (predicate) => inSection.filter(predicate).length;
  const option = (id, label, n) => ({ id, label: `${label} (${n})` });
  const dropdown = (list, key) => (catalogue ? [{ id: "all", label: `All ${key}` }, ...list.map((x) => option(x.id, x.label, count((r) => (key === "types" ? r.type === x.id : key === "capabilities" ? r.capabilities.includes(x.id) : r.industries.includes(x.id))))).filter((o) => !o.label.endsWith("(0)"))] : []);
  const typeItems = dropdown(taxonomy?.types ?? [], "types");
  const capItems = dropdown(taxonomy?.capabilities ?? [], "capabilities");
  const indItems = dropdown(taxonomy?.industries ?? [], "industries");
  const selected = (items, id) => items.find((i) => i.id === id) || items[0];

  return (
    <Grid className="page">
      <Column sm={4} md={8} lg={12}>
        <p className="eyebrow">Browse resources · I know what I'm looking for</p>
        <h1 className="page-title page-title--sm">{sectionMeta ? sectionMeta.label : "All AIIS resources"}</h1>
        <p className="page-lede">
          {sectionMeta ? sectionMeta.blurb : "Everything AIIS has published, grouped by what it is. Not sure what you need? "}
          {!sectionMeta && <Link as={RouterLink} to="/accelerator">Describe your client need instead</Link>}
          {!sectionMeta && "."}
        </p>
      </Column>

      <Column sm={4} md={8} lg={16} className="browse-controls">
        <Search labelText="Search resources" placeholder={sectionMeta ? `Search ${sectionMeta.label.toLowerCase()}` : "Search everything by title, description or keyword"} value={q} onChange={(e) => set("q", e.target.value)} size="lg" />
      </Column>

      {/* Landing: the structure */}
      {!listView && catalogue && taxonomy.sections.map((s) => {
        const items = catalogue.resources.filter((r) => r.section === s.id);
        return (
          <Column key={s.id} sm={4} md={4} lg={5} className="browse-col">
            <ClickableTile className="section-tile" onClick={() => set("section", s.id)}>
              <p className="section-tile__count">{items.length} {items.length === 1 ? "resource" : "resources"}</p>
              <h2 className="section-tile__title">{s.label}</h2>
              <p className="section-tile__blurb">{s.blurb}</p>
              <span className="entry-tile__cta">Open <ArrowRight /></span>
            </ClickableTile>
          </Column>
        );
      })}

      {!listView && catalogue?.hubUrl && (
        <Column sm={4} md={8} lg={16} className="home-footer">
          <p>{catalogue.resources.length} resources in total. Every item links to its authoritative source — nothing is copied into the hub.</p>
        </Column>
      )}

      {/* List: one section, or a search across everything */}
      {listView && (
        <>
          <Column sm={4} md={8} lg={16} className="browse-controls">
            <div className="browse-filters">
              <ContentSwitcher selectedIndex={Math.max(0, MODES.findIndex((m) => m.id === mode))} onChange={({ name }) => set("mode", name)} size="md" className="browse-modes">
                {MODES.map((m) => <Switch key={m.id} name={m.id} text={m.label} />)}
              </ContentSwitcher>
              <Dropdown id="f-type" titleText="Type" label="Type" items={typeItems} itemToString={(i) => i?.label || ""} selectedItem={selected(typeItems, type)} onChange={({ selectedItem }) => set("type", selectedItem?.id)} size="md" />
              <Dropdown id="f-capability" titleText="Capability" label="Capability" items={capItems} itemToString={(i) => i?.label || ""} selectedItem={selected(capItems, capability)} onChange={({ selectedItem }) => set("capability", selectedItem?.id)} size="md" />
              <Dropdown id="f-industry" titleText="Industry" label="Industry" items={indItems} itemToString={(i) => i?.label || ""} selectedItem={selected(indItems, industry)} onChange={({ selectedItem }) => set("industry", selectedItem?.id)} size="md" />
            </div>
          </Column>

          <Column sm={4} md={8} lg={16} className="browse-meta">
            <Button kind="ghost" size="sm" renderIcon={ArrowLeft} onClick={() => setParams(new URLSearchParams(), { replace: true })}>All sections</Button>
            <p className="browse-count" aria-live="polite">{loading ? "Loading inventory…" : `${filtered.length} ${filtered.length === 1 ? "resource" : "resources"}${section ? "" : " across all sections"}`}</p>
          </Column>

          {loading && [0, 1, 2].map((i) => <Column key={i} sm={4} md={4} lg={5}><Tile className="browse-tile"><SkeletonText paragraph lineCount={4} /></Tile></Column>)}

          {!loading && filtered.length === 0 && (
            <Column sm={4} md={8} lg={10}>
              <Tile className="empty-state">
                <h2>No resources match this</h2>
                <p>Try fewer filters or another section, or describe what you're trying to accomplish and let the Deal Accelerator find what fits.</p>
                <div className="empty-state__actions">
                  <Button kind="tertiary" size="md" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Back to all sections</Button>
                  <Button as={RouterLink} to={`/accelerator${q ? `?q=${encodeURIComponent(q)}` : ""}`} kind="primary" size="md" renderIcon={ArrowRight}>Use the Deal Accelerator</Button>
                </div>
              </Tile>
            </Column>
          )}

          {filtered.map((r) => (
            <Column key={r.id} sm={4} md={4} lg={5} className="browse-col">
              <Tile className="browse-tile">
                <ResourceTags type={r.type} typeLabel={labelFor(taxonomy.types, r.type)} status={r.status} readiness={r.readiness} readinessLabel={labelFor(taxonomy.readiness, r.readiness)} />
                <h2 className="browse-tile__title">{r.title}</h2>
                <p className="browse-tile__desc">{r.description}</p>
                <p className="browse-tile__meta"><span className="label">Best for</span> {r.purpose}</p>
                {r.industries.length > 0 && <p className="browse-tile__meta"><span className="label">Industry</span> {r.industries.map((i) => labelFor(taxonomy.industries, i)).join(", ")}</p>}
                {!section && <Tag size="sm" type="outline" className="browse-tile__section">{labelFor(taxonomy.sections, r.section)}</Tag>}
                <div className="browse-tile__actions"><ResourceActions actions={r.actions.slice(0, 1)} source={r.authoritativeSource} size="sm" /></div>
              </Tile>
            </Column>
          ))}
        </>
      )}
    </Grid>
  );
}
