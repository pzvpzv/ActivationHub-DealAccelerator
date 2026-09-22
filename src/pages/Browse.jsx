import { useMemo } from "react";
import { useSearchParams, Link as RouterLink } from "react-router-dom";
import { Grid, Column, Search, Dropdown, ContentSwitcher, Switch, Tile, Button, InlineNotification, SkeletonText, Link } from "@carbon/react";
import { ArrowRight } from "@carbon/icons-react";
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
  const mode = params.get("mode") || "all";
  const type = params.get("type") || "all";
  const capability = params.get("capability") || "all";
  const industry = params.get("industry") || "all";

  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    if (!catalogue) return [];
    return catalogue.resources.filter((r) =>
      matchesText(r, q) &&
      (mode === "all" || r.modes.includes(mode)) &&
      (type === "all" || r.type === type) &&
      (capability === "all" || r.capabilities.includes(capability)) &&
      (industry === "all" || r.industries.includes(industry))
    );
  }, [catalogue, q, mode, type, capability, industry]);

  if (error) return <Grid className="page"><Column sm={4} md={8} lg={12}><InlineNotification kind="error" title="Couldn't load the resource inventory" subtitle={error.message} hideCloseButton /></Column></Grid>;

  const { taxonomy } = catalogue || {};
  const count = (predicate) => catalogue?.resources.filter(predicate).length ?? 0;
  const option = (id, label, n) => ({ id, label: `${label} (${n})` });
  const typeItems = catalogue ? [{ id: "all", label: "All types" }, ...taxonomy.types.map((t) => option(t.id, t.label, count((r) => r.type === t.id))).filter((o) => !o.label.endsWith("(0)"))] : [];
  const capItems = catalogue ? [{ id: "all", label: "All capabilities" }, ...taxonomy.capabilities.map((c) => option(c.id, c.label, count((r) => r.capabilities.includes(c.id)))).filter((o) => !o.label.endsWith("(0)"))] : [];
  const indItems = catalogue ? [{ id: "all", label: "All industries" }, ...taxonomy.industries.map((i) => option(i.id, i.label, count((r) => r.industries.includes(i.id)))).filter((o) => !o.label.endsWith("(0)"))] : [];
  const selected = (items, id) => items.find((i) => i.id === id) || items[0];
  const clear = () => setParams(new URLSearchParams(), { replace: true });

  return (
    <Grid className="page">
      <Column sm={4} md={8} lg={12}>
        <p className="eyebrow">Browse resources · I know what I'm looking for</p>
        <h1 className="page-title page-title--sm">All AIIS resources</h1>
        <p className="page-lede">The same inventory the Deal Accelerator recommends from. Not sure what you need?{" "}
          <Link as={RouterLink} to="/accelerator">Describe your client need instead</Link>.</p>
      </Column>

      <Column sm={4} md={8} lg={16} className="browse-controls">
        <Search labelText="Search resources" placeholder="Search titles, descriptions and keywords" value={q} onChange={(e) => set("q", e.target.value)} size="lg" />
        {catalogue && (
          <div className="browse-filters">
            <ContentSwitcher selectedIndex={Math.max(0, MODES.findIndex((m) => m.id === mode))} onChange={({ name }) => set("mode", name)} size="md" className="browse-modes">
              {MODES.map((m) => <Switch key={m.id} name={m.id} text={m.label} />)}
            </ContentSwitcher>
            <Dropdown id="f-type" titleText="Type" label="Type" items={typeItems} itemToString={(i) => i?.label || ""} selectedItem={selected(typeItems, type)} onChange={({ selectedItem }) => set("type", selectedItem?.id)} size="md" />
            <Dropdown id="f-capability" titleText="Capability" label="Capability" items={capItems} itemToString={(i) => i?.label || ""} selectedItem={selected(capItems, capability)} onChange={({ selectedItem }) => set("capability", selectedItem?.id)} size="md" />
            <Dropdown id="f-industry" titleText="Industry" label="Industry" items={indItems} itemToString={(i) => i?.label || ""} selectedItem={selected(indItems, industry)} onChange={({ selectedItem }) => set("industry", selectedItem?.id)} size="md" />
          </div>
        )}
      </Column>

      <Column sm={4} md={8} lg={16}>
        <p className="browse-count" aria-live="polite">{loading ? "Loading inventory…" : `${filtered.length} of ${catalogue.resources.length} resources`}</p>
      </Column>

      {loading && [0, 1, 2].map((i) => <Column key={i} sm={4} md={4} lg={5}><Tile className="browse-tile"><SkeletonText paragraph lineCount={4} /></Tile></Column>)}

      {!loading && filtered.length === 0 && (
        <Column sm={4} md={8} lg={10}>
          <Tile className="empty-state">
            <h2>No resources match these filters</h2>
            <p>Try fewer filters, or describe what you're trying to accomplish and let the Deal Accelerator find what fits.</p>
            <div className="empty-state__actions">
              <Button kind="tertiary" size="md" onClick={clear}>Clear filters</Button>
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
            <div className="browse-tile__actions"><ResourceActions actions={r.actions.slice(0, 1)} source={r.authoritativeSource} size="sm" /></div>
          </Tile>
        </Column>
      ))}
    </Grid>
  );
}
