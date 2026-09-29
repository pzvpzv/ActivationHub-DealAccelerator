import { useEffect, useState } from "react";
import { fetchCatalogue } from "./client.js";
import { withSections } from "../../server/catalogue/sections.js";

let pending = null;

/** Loads the shared resource catalogue once per page load. */
export function useCatalogue() {
  const [state, setState] = useState({ catalogue: null, error: null, loading: true });
  useEffect(() => {
    let active = true;
    // The static build fetches the raw catalogue file, so sections are resolved here too.
    pending ??= fetchCatalogue()
      .then((c) => ({ ...c, resources: withSections(c.taxonomy, c.resources) }))
      .catch((error) => { pending = null; throw error; });
    pending.then(
      (catalogue) => active && setState({ catalogue, error: null, loading: false }),
      (error) => active && setState({ catalogue: null, error, loading: false })
    );
    return () => { active = false; };
  }, []);
  return state;
}

export const labelFor = (list, id) => list?.find((x) => x.id === id)?.label ?? id;
