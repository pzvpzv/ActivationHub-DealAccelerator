// Which hub section a resource belongs to. Browser-safe (no Node imports) so the server
// loader and the static build resolve sections with the same rule.

/** A resource sits in the section its type belongs to, unless it names its own. */
export function sectionFor(resource, taxonomy) {
  return resource.section || taxonomy.types.find((t) => t.id === resource.type)?.section || null;
}

/** Resolves sections for a raw catalogue file, as loaded in the browser. */
export function withSections(taxonomy, resources) {
  return resources.map((r) => ({ ...r, section: sectionFor(r, taxonomy) }));
}
