import { Tile, Tag } from "@carbon/react";
import { labelFor } from "../api/useCatalogue.js";
import { ResourceTags } from "./ResourceTags.jsx";
import { ResourceActions } from "./ResourceActions.jsx";

/** One resource as it appears in a list. Shared by Browse and the Training page. */
export function ResourceTile({ resource: r, taxonomy, showSection = false }) {
  return (
    <Tile className="browse-tile">
      <ResourceTags type={r.type} typeLabel={labelFor(taxonomy.types, r.type)} status={r.status}
        readiness={r.readiness} readinessLabel={labelFor(taxonomy.readiness, r.readiness)} />
      <h2 className="browse-tile__title">{r.title}</h2>
      <p className="browse-tile__desc">{r.description}</p>
      <p className="browse-tile__meta"><span className="label">Best for</span> {r.purpose}</p>
      {r.industries.length > 0 && <p className="browse-tile__meta"><span className="label">Industry</span> {r.industries.map((i) => labelFor(taxonomy.industries, i)).join(", ")}</p>}
      {showSection && <Tag size="sm" type="outline" className="browse-tile__section">{labelFor(taxonomy.sections, r.section)}</Tag>}
      <div className="browse-tile__actions"><ResourceActions actions={r.actions.slice(0, 1)} source={r.authoritativeSource} size="sm" /></div>
    </Tile>
  );
}
