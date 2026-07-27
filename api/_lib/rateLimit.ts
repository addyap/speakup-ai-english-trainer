// In-memory rate limiter — shared within one process lifetime.
// On Replit (persistent Express): shared across all requests to that instance.
// On Vercel (serverless): per warm-function-instance; each cold start resets the window.
// NOTE: for cross-instance enforcement on Vercel, replace with an Upstash Redis counter.

const _rateWindows = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
// A single voice turn = STT + conversation + TTS (~3 calls), plus replays,
// hints and "improve". 90/min comfortably covers an active human session
// while still capping abuse. Raise via Upstash if this ever needs to be
// enforced consistently across serverless instances.
const RATE_MAX = 90;

export function checkRateLimit(
  headers: Record<string, string | string[] | undefined>,
  remoteAddress?: string,
): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();

  if (_rateWindows.size > 500) {
    for (const [k, w] of _rateWindows) {
      if (now > w.resetAt) { _rateWindows.delete(k); break; }
    }
  }

  const xff = headers["x-forwarded-for"];
  const ip =
    (typeof xff === "string" ? xff.split(",")[0].trim() : undefined) ??
    remoteAddress ??
    "anon";

  const w = _rateWindows.get(ip);
  if (!w || now > w.resetAt) {
    _rateWindows.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true };
  }
  if (w.count >= RATE_MAX) {
    return { ok: false, retryAfter: Math.ceil((w.resetAt - now) / 1000) };
  }
  w.count++;
  return { ok: true };
}
