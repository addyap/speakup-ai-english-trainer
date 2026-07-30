import { track } from "@vercel/analytics";

// Thin wrapper around Vercel Web Analytics custom events (cookieless, anonymous).
// The app is a single-URL SPA, so the funnel is measured with explicit events
// rather than page views. Never pass anything that identifies a user.

type EventName =
  | "view"            // a view was shown (home / setup / conversation / feedback / grammar / privacy)
  | "session_start"   // learner started a practice session
  | "first_message"   // learner sent their first message of a session
  | "session_complete"// end-of-session feedback was generated
  | "grammar_open";   // opened a grammar lesson

type Props = Record<string, string | number | boolean | null>;

export function trackEvent(name: EventName, props?: Props): void {
  try {
    track(name, props);
  } catch {
    // analytics must never break the app
  }
}
