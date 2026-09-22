// The user's own Anthropic key for the static (GitHub Pages) build.
// Stored only in this browser: sessionStorage by default (gone when the tab closes),
// localStorage only if the user ticks "remember on this device". Never sent anywhere
// except api.anthropic.com.
const KEY = "aiis-hub-anthropic-key";

function read(storage) {
  try { return storage.getItem(KEY) || ""; } catch { return ""; }
}

export function getBrowserKey() {
  return read(sessionStorage) || read(localStorage);
}

export function isKeyRemembered() {
  return Boolean(read(localStorage));
}

export function setBrowserKey(value, remember) {
  clearBrowserKey();
  try { (remember ? localStorage : sessionStorage).setItem(KEY, value.trim()); } catch { /* storage blocked: key lives for this page only */ }
}

export function clearBrowserKey() {
  for (const storage of [sessionStorage, localStorage]) {
    try { storage.removeItem(KEY); } catch { /* ignore */ }
  }
}
