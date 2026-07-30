import * as Sentry from "@sentry/react";

// Error monitoring — so real crashes on users' devices become visible instead
// of dying silently in their console. Deliberately minimal and privacy-first
// for an EU education app: production only, no Session Replay, no performance
// tracing, and no default PII (IP addresses are not attached). The DSN is a
// public client key (it can only SEND events, not read them), so it is safe to
// ship in the bundle. Region: EU (…ingest.de.sentry.io).
export function initSentry(): void {
  if (!import.meta.env.PROD) return; // never report from local dev
  Sentry.init({
    dsn: "https://2c807d9519bb7e1a50c67db7d127f7ef@o4511825180819456.ingest.de.sentry.io/4511825192026192",
    environment: "production",
    sendDefaultPii: false,
    tracesSampleRate: 0, // errors only
  });
}

export { Sentry };
