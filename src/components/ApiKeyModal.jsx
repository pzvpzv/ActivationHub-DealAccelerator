import { useState } from "react";
import { Modal, PasswordInput, Checkbox } from "@carbon/react";
import { setBrowserKey, isKeyRemembered } from "../api/browserKey.js";

/** Lets the person using the static site supply their own Anthropic key, kept in this browser only. */
export function ApiKeyModal({ open, onClose, onSaved }) {
  const [value, setValue] = useState("");
  const [remember, setRemember] = useState(isKeyRemembered());
  const valid = value.trim().startsWith("sk-ant-") && value.trim().length > 20;
  const save = () => {
    if (!valid) return;
    setBrowserKey(value, remember);
    setValue("");
    onSaved();
  };
  return (
    <Modal open={open} modalHeading="Use AI with your own API key" primaryButtonText="Save key" secondaryButtonText="Cancel"
      primaryButtonDisabled={!valid} onRequestSubmit={save} onRequestClose={() => { setValue(""); onClose(); }} size="sm">
      <div className="key-modal">
        <p>This copy of the Activation Hub runs entirely in your browser on GitHub Pages, so there's no server to hold an API key. To turn on AI analysis, add your own Anthropic API key.</p>
        <ul className="key-modal__facts">
          <li>Stored only in this browser — never in the site, the repository or anywhere else.</li>
          <li>Sent only to Anthropic (api.anthropic.com) when you run a request. Each request is billed to your key.</li>
          <li>{remember ? "Kept on this device until you remove it." : "Forgotten when you close this tab."}</li>
        </ul>
        <PasswordInput id="api-key" labelText="Anthropic API key" placeholder="sk-ant-…" value={value} autoComplete="off"
          onChange={(e) => setValue(e.target.value)} invalid={value.length > 0 && !valid} invalidText="Anthropic keys start with sk-ant-" />
        <Checkbox id="remember-key" labelText="Remember on this device" checked={remember} onChange={(_, { checked }) => setRemember(checked)} />
        <p className="key-modal__note">Only use this on your own computer. Get a key at console.anthropic.com.</p>
      </div>
    </Modal>
  );
}
