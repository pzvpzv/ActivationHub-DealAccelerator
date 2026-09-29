import { Link } from "@carbon/react";

const VERSION = import.meta.env.VITE_VERSION || "dev";
const BASE = import.meta.env.BASE_URL;
// A tagged build is served from /<repo>/v/<tag>/; the index of versions sits one level above it.
const isTagged = /\/v\/[^/]+\/$/.test(BASE);
const versionsHref = isTagged ? BASE.replace(/[^/]+\/$/, "") : `${BASE}v/`;

export function VersionFooter() {
  return (
    <footer className="hub-footer">
      <p>
        IBM Consulting · AI Integration Services — Activation Hub prototype
        {" · "}
        <span className="hub-footer__version">{isTagged ? `Version ${VERSION}` : VERSION === "latest" ? "Latest version" : "Local development"}</span>
        {" · "}
        <Link href={versionsHref}>All versions</Link>
      </p>
    </footer>
  );
}
