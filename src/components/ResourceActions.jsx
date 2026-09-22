import { useState } from "react";
import { Button } from "@carbon/react";
import { Launch, Copy, Email } from "@carbon/icons-react";

const isMail = (url) => url.startsWith("mailto:");

/** Actions that take the user to the authoritative destination (never rebuilt inside the hub). */
export function ResourceActions({ actions, source, size = "md" }) {
  const [copied, setCopied] = useState(false);
  const primary = actions[0];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(primary.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", primary.url);
    }
  };
  return (
    <div className="resource-actions">
      <div className="resource-actions__buttons">
        {actions.map((action, i) => (
          <Button key={action.url + action.label} kind={i === 0 ? "primary" : "tertiary"} size={size} href={action.url}
            target={isMail(action.url) ? undefined : "_blank"} rel="noopener noreferrer" renderIcon={isMail(action.url) ? Email : Launch}>
            {action.label}
          </Button>
        ))}
        {!isMail(primary.url) && (
          <Button kind="ghost" size={size} renderIcon={Copy} onClick={copy} iconDescription="Copy link">{copied ? "Link copied" : "Copy link"}</Button>
        )}
      </div>
      <p className="resource-actions__source">Opens in {source}. Sign in with your IBM credentials if prompted.</p>
    </div>
  );
}
