import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ensureLanguage, type Language } from "./i18n/translations";
import { getLearnerProfile } from "./lib/learnerMemory";

// Preload the saved interface language's chunk BEFORE first paint, so a
// returning non-English user doesn't see a flash of English. The static
// crawlable hero in index.html stays visible during this brief await.
async function boot() {
  try {
    await ensureLanguage(getLearnerProfile().preferredInterfaceLanguage as Language);
  } catch {
    /* fall back to the bundled English */
  }
  createRoot(document.getElementById("root")!).render(<App />);
}
void boot();

// Register the service worker (install + offline shell). Production only —
// during dev it would cache the Vite dev server and interfere with HMR.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is best-effort; ignore registration failures */
    });
  });
}
