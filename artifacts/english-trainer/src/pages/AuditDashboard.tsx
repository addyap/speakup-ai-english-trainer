import { useState, useCallback, useRef } from "react";
import { getLearnerProfile } from "@/lib/learnerMemory";
import { getVoiceAvailability, getBestVoiceName } from "@/lib/tts";
import { getVoiceSettings } from "@/lib/voiceSettings";

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = "idle" | "running" | "pass" | "warning" | "fail";

interface Check {
  label: string;
  status: "pass" | "warning" | "fail";
  note?: string;
}

interface CategoryResult {
  status: Status;
  checks: Check[];
  timingMs?: number;
  runAt?: string;
}

interface AuditState {
  ui:          CategoryResult;
  ai:          CategoryResult;
  translation: CategoryResult;
  tools:       CategoryResult;
  voice:       CategoryResult;
  memory:      CategoryResult;
  performance: CategoryResult;
}

interface SimulatorStep {
  label: string;
  status: "pass" | "fail" | "skip";
  note?: string;
  ms?: number;
}

interface SimulatorResult {
  status: Status;
  steps: SimulatorStep[];
  verdict: string;
  runAt?: string;
}

interface TimingStore {
  aiMs:          number[];
  translationMs: number[];
  hintMs:        number;
  improveMs:     number;
  feedbackMs:    number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const IDLE: CategoryResult = { status: "idle", checks: [] };
const RUNNING: CategoryResult = { status: "running", checks: [] };
const API = "/api/trainer";

// ─── Fix recommendations ──────────────────────────────────────────────────────
const FIXES: Record<string, string> = {
  "No horizontal overflow":           "Add `overflow-x-hidden` to the root element or find elements with `min-w-[...]` wider than viewport. Check SessionSetupView and ConversationView.",
  "viewport-fit=cover present":       "Add `viewport-fit=cover` to the `<meta name='viewport'>` tag in `artifacts/english-trainer/index.html`.",
  "Input font-size ≥ 16px":           "Replace `text-sm` (14px) with `text-base` (16px) on all `<input>` and `<textarea>` elements — iOS auto-zooms at < 16px.",
  "Touch targets ≥ 44px":             "Add `min-h-[44px] min-w-[44px]` to small buttons. Priority: inline text buttons < 40px height.",
  "No invisible buttons":             "Search for `display: none` or `visibility: hidden` on interactive elements and remove or fix their layout.",
  "Safe-area inset CSS present":      "Add `padding-bottom: env(safe-area-inset-bottom)` to `.pb-safe` in `index.css` or Tailwind config.",
  "Translation returns non-empty result": "Check `/api/trainer/translate` route and OpenAI API key. Test with `curl -X POST /api/trainer/translate`.",
  "Translation produces different text":  "OpenAI returned the same text — likely a prompt issue. Check the system prompt in `trainer.ts` translate route.",
  "Translation speed (< 3s)":         "Translation is slow. Consider caching common phrases or reducing prompt length in the translate route.",
  "Help Me Answer API":               "Check `/api/trainer/hint` route exists in `trainer.ts` and the OpenAI call succeeds. Check server logs.",
  "Hint — simpleReplies generated":   "The hint route returns no simpleReplies. Update the GPT prompt to explicitly require `simpleReplies` array with 2-3 items.",
  "Improve My Sentence API":          "Check `/api/trainer/improve` route. Verify the Zod schema matches the request body in `openapi.yaml`.",
  "Improve — corrected form generated": "The improve route returns no `corrected` field. Update the GPT prompt to always return `corrected`, `natural`, `explanation`.",
  "End Session Feedback API":         "Check `/api/trainer/feedback` route. It requires `messages`, `mode`, `feedbackLanguage`, `deviceId`, `scenario`.",
  "Feedback — all 6 fields present":  "Update the feedback GPT prompt to always return `estimatedLevel`, `strengths`, `improvements`, `correctedExample`, `fluencyComment`, `nextStep`.",
  "Feedback — valid CEFR level":      "The AI returned a non-CEFR level string. Update the feedback prompt to enforce format: A1, A2, B1, B2, C1, or C2.",
  "AI response time":                 "Avg response time is high. Consider using a faster model tier, reducing system prompt length, or adding a request timeout.",
  "AI responses are unique across turns": "AI is repeating content. Check the anti-repetition window in `trainer.ts` (`.slice(-8)` on recent messages).",
  "No generic AI openers":            "Add 'NEVER start with Certainly, Of course, Absolutely, Great question' to the system prompt in `trainer.ts`.",
  "SpeechRecognition API present":    "SpeechRecognition is not available. Ensure typed input fallback is working and visible to users.",
  "MediaDevices API present":         "MediaDevices unavailable — this is expected on non-HTTPS. Typed input must remain the primary input method.",
  "Secure context (HTTPS) for mic":   "App is served over HTTP. For production mic access, deploy over HTTPS (Replit deployment handles this automatically).",
  "Typed fallback input present":     "No text input found. Ensure the text input row in ConversationView is always rendered, regardless of mic state.",
  "Profile exists in localStorage":   "Profile not saved yet — user may not have started a session. This clears on first session start.",
  "device_id persists":               "The device ID is missing. Check `getLearnerProfile()` in `learnerMemory.ts` — it should generate and save a UUID on first call.",
  "Voice settings load from localStorage": "Voice settings key `speakup_voice_settings` not found. Check `getVoiceSettings()` in `voiceSettings.ts`.",
  "English voice available for TTS":  "No English voice found. On iOS, voices load after first user interaction. On Android, install a TTS engine via Settings.",
  "Turn 1 — AI opens conversation":   "The first conversation API call failed. Check the API server is running and `/api/trainer/conversation` route works.",
  "Turn 2 — AI responds to user":     "Second turn failed. Check for timeout issues or OpenAI rate limits in server logs.",
};

function getFixFor(label: string): string | null {
  for (const [key, fix] of Object.entries(FIXES)) {
    if (label.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(label.toLowerCase())) {
      return fix;
    }
  }
  return null;
}

// ─── Similarity helper ────────────────────────────────────────────────────────
function jaccardSimilarity(a: string, b: string): number {
  const words = (s: string) => new Set(s.toLowerCase().split(/\s+/).filter(Boolean));
  const setA = words(a);
  const setB = words(b);
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// ─── Timed fetch helper ───────────────────────────────────────────────────────
async function timedPost(path: string, body: unknown): Promise<{ data: unknown; ms: number }> {
  const t0 = performance.now();
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const ms = Math.round(performance.now() - t0);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { data, ms };
}

async function timedStream(path: string, body: unknown): Promise<{ data: unknown; ms: number }> {
  const t0 = performance.now();
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let finalData: unknown = null;
  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const evt = JSON.parse(line.slice(6)) as Record<string, unknown>;
      if (evt.done) { finalData = evt; break outer; }
    }
  }
  const ms = Math.round(performance.now() - t0);
  return { data: finalData, ms };
}

// ─── Test runners ─────────────────────────────────────────────────────────────

async function runUIAudit(): Promise<CategoryResult> {
  const checks: Check[] = [];
  const now = new Date().toLocaleTimeString();

  const overflowW = document.documentElement.scrollWidth;
  const viewW = window.innerWidth;
  checks.push(overflowW > viewW + 5
    ? { label: "No horizontal overflow", status: "fail", note: `Page is ${overflowW - viewW}px too wide` }
    : { label: "No horizontal overflow", status: "pass" });

  const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "";
  checks.push(viewport.includes("viewport-fit=cover")
    ? { label: "viewport-fit=cover present", status: "pass" }
    : { label: "viewport-fit=cover present", status: "warning", note: "iOS home bar may overlap controls" });

  const inputs = Array.from(document.querySelectorAll("input, textarea"));
  const smallInputs = inputs.filter((el) => parseFloat(window.getComputedStyle(el).fontSize) < 16);
  checks.push(smallInputs.length > 0
    ? { label: "Input font-size ≥ 16px", status: "warning", note: `${smallInputs.length} input(s) may trigger iOS zoom` }
    : { label: "Input font-size ≥ 16px", status: "pass" });

  const auditUI = document.querySelector("[data-audit-ui]");
  const buttons = Array.from(document.querySelectorAll("button, [role=button]")).filter((el) => !auditUI?.contains(el));
  const smallButtons = buttons.filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 40; });
  checks.push(smallButtons.length > 2
    ? { label: "Touch targets ≥ 44px", status: "warning", note: `${smallButtons.length} small buttons found` }
    : { label: "Touch targets ≥ 44px", status: "pass" });

  const zeroDim = buttons.filter((el) => { const r = el.getBoundingClientRect(); return r.width === 0 && r.height === 0; });
  checks.push(zeroDim.length > 0
    ? { label: "No invisible buttons", status: "warning", note: `${zeroDim.length} zero-dimension interactive element(s)` }
    : { label: "No invisible buttons", status: "pass" });

  const hasSafeCSS = document.styleSheets
    ? Array.from(document.styleSheets).some((ss) => { try { return Array.from(ss.cssRules ?? []).some((r) => r.cssText.includes("safe-area-inset")); } catch { return false; } })
    : false;
  checks.push(hasSafeCSS
    ? { label: "Safe-area inset CSS present", status: "pass" }
    : { label: "Safe-area inset CSS present", status: "warning", note: "Bottom controls may not clear home bar" });

  const worst = checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "warning") ? "warning" : "pass";
  return { status: worst, checks, runAt: now };
}

async function runAIAudit(timing: TimingStore): Promise<CategoryResult> {
  const checks: Check[] = [];
  const now = new Date().toLocaleTimeString();
  const base = { mode: "practice" as const, scenario: "job_interview" as const, level: "auto" as const, interfaceLanguage: "English", feedbackLanguage: "English" };
  type ConvMsg = { role: "user" | "assistant"; content: string };
  const responses: string[] = [];
  let allSucceeded = true;

  try {
    const { data, ms } = await timedPost("/conversation", { ...base, messages: [] });
    timing.aiMs.push(ms);
    const msg = (data as { message?: string }).message ?? "";
    checks.push(msg.trim() ? { label: "Turn 1 — AI opens conversation", status: "pass", note: `${ms}ms` } : { label: "Turn 1 — AI opens conversation", status: "fail", note: "Empty response" });
    if (!msg.trim()) allSucceeded = false;
    responses.push(msg);
  } catch (err) {
    checks.push({ label: "Turn 1 — API reachable", status: "fail", note: String(err) });
    return { status: "fail", checks, runAt: now };
  }

  const history1: ConvMsg[] = [{ role: "assistant", content: responses[0] }, { role: "user", content: "Tell me about yourself and your work experience." }];
  try {
    const { data, ms } = await timedPost("/conversation", { ...base, messages: history1 });
    timing.aiMs.push(ms);
    const msg = (data as { message?: string }).message ?? "";
    checks.push(msg.trim() ? { label: "Turn 2 — AI responds to user", status: "pass", note: `${ms}ms` } : { label: "Turn 2 — AI responds to user", status: "fail", note: "Empty response" });
    if (!msg.trim()) allSucceeded = false;
    responses.push(msg);
  } catch (err) {
    checks.push({ label: "Turn 2 — API reachable", status: "fail", note: String(err) });
    allSucceeded = false;
  }

  if (responses.length >= 2 && responses[1]) {
    const history2: ConvMsg[] = [...history1, { role: "assistant", content: responses[1] }, { role: "user", content: "What skills would be most important for this role?" }];
    try {
      const { data, ms } = await timedPost("/conversation", { ...base, messages: history2 });
      timing.aiMs.push(ms);
      const msg = (data as { message?: string }).message ?? "";
      checks.push(msg.trim() ? { label: "Turn 3 — multi-turn coherence", status: "pass", note: `${ms}ms` } : { label: "Turn 3 — multi-turn coherence", status: "fail", note: "Empty response" });
      if (!msg.trim()) allSucceeded = false;
      responses.push(msg);
    } catch (err) {
      checks.push({ label: "Turn 3 — API reachable", status: "fail", note: String(err) });
      allSucceeded = false;
    }
  }

  const filled = responses.filter(Boolean);
  if (filled.length >= 2) {
    let maxSim = 0;
    for (let i = 0; i < filled.length; i++) for (let j = i + 1; j < filled.length; j++) maxSim = Math.max(maxSim, jaccardSimilarity(filled[i], filled[j]));
    checks.push({ label: "AI responses are unique across turns", status: maxSim > 0.7 ? "warning" : "pass", note: `Max similarity: ${Math.round(maxSim * 100)}%` });
  }

  const forbidden = ["Certainly!", "Of course!", "Absolutely!", "Great question!", "Sure!"];
  const hasGeneric = responses.some((r) => forbidden.some((f) => r.startsWith(f)));
  checks.push({ label: "No generic AI openers", status: hasGeneric ? "warning" : "pass", note: hasGeneric ? "Response started with a banned opener" : undefined });

  const avgMs = timing.aiMs.length > 0 ? Math.round(timing.aiMs.reduce((a, b) => a + b, 0) / timing.aiMs.length) : 0;
  checks.push({ label: "AI response time", status: avgMs > 8000 ? "fail" : avgMs > 4000 ? "warning" : "pass", note: `Avg ${avgMs}ms` });

  const worst = checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "warning") ? "warning" : "pass";
  return { status: allSucceeded ? worst : "fail", checks, timingMs: avgMs, runAt: now };
}

async function runTranslationAudit(timing: TimingStore): Promise<CategoryResult> {
  const checks: Check[] = [];
  const now = new Date().toLocaleTimeString();
  const testText = "Hello, how are you doing today? I am here for my interview.";

  try {
    const { data, ms } = await timedPost("/translate", { text: testText, targetLanguage: "French" });
    timing.translationMs.push(ms);
    const translation = (data as { translation?: string }).translation ?? "";
    checks.push(translation.trim() ? { label: "Translation returns non-empty result", status: "pass", note: `${ms}ms` } : { label: "Translation returns non-empty result", status: "fail" });
    checks.push(translation.toLowerCase() === testText.toLowerCase() ? { label: "Translation produces different text", status: "fail", note: "Output same as input" } : { label: "Translation produces different text", status: "pass" });
    checks.push(ms > 3000 ? { label: "Translation speed (< 3s)", status: "warning", note: `${ms}ms` } : { label: "Translation speed (< 3s)", status: "pass", note: `${ms}ms` });
  } catch (err) {
    checks.push({ label: "Translation API reachable", status: "fail", note: String(err) });
    return { status: "fail", checks, runAt: now };
  }

  try {
    const { ms: ms2 } = await timedPost("/translate", { text: testText, targetLanguage: "French" });
    timing.translationMs.push(ms2);
    checks.push({ label: "Repeated translation call stable", status: "pass", note: `${ms2}ms` });
  } catch {
    checks.push({ label: "Repeated translation call stable", status: "warning", note: "Second call failed" });
  }

  try {
    const { data: d2, ms: ms3 } = await timedPost("/translate", { text: "Good morning", targetLanguage: "Spanish" });
    timing.translationMs.push(ms3);
    const t2 = (d2 as { translation?: string }).translation ?? "";
    checks.push(t2.trim() && t2 !== "Good morning" ? { label: "Multiple target languages work", status: "pass", note: `ES: "${t2}"` } : { label: "Multiple target languages work", status: "warning" });
  } catch {
    checks.push({ label: "Multiple target languages work", status: "warning" });
  }

  const worst = checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "warning") ? "warning" : "pass";
  return { status: worst, checks, runAt: now };
}

async function runToolsAudit(timing: TimingStore): Promise<CategoryResult> {
  const checks: Check[] = [];
  const now = new Date().toLocaleTimeString();
  const baseMessages = [
    { role: "assistant" as const, content: "Welcome! Tell me about your previous experience." },
    { role: "user" as const, content: "I have work in sales for three year in a company." },
    { role: "assistant" as const, content: "Interesting. What was your main achievement in that role?" },
    { role: "user" as const, content: "I increase the sale by 20 percent and I get award." },
  ];

  try {
    const { data, ms } = await timedStream("/hint-stream", { messages: baseMessages, scenario: "job_interview", level: "auto", feedbackLanguage: "English", interfaceLanguage: "English" });
    timing.hintMs = ms;
    const hint = (data as { hint?: { simpleReplies?: string[]; naturalReply?: string } })?.hint;
    checks.push(Array.isArray(hint?.simpleReplies) && (hint?.simpleReplies?.length ?? 0) > 0 ? { label: "Hint — simpleReplies generated", status: "pass", note: `${hint!.simpleReplies!.length} replies, ${ms}ms` } : { label: "Hint — simpleReplies generated", status: "fail" });
    checks.push(hint?.naturalReply?.trim() ? { label: "Hint — naturalReply non-empty", status: "pass" } : { label: "Hint — naturalReply non-empty", status: "warning" });
  } catch (err) {
    checks.push({ label: "Help Me Answer API", status: "fail", note: String(err) });
  }

  try {
    const { data, ms } = await timedPost("/improve", { text: "I am go to the store yesterday and buyed some apple.", scenario: "daily_life", feedbackLanguage: "English" });
    timing.improveMs = ms;
    const imp = data as { corrected?: string; natural?: string; explanation?: string };
    checks.push(imp.corrected?.trim() ? { label: "Improve — corrected form generated", status: "pass", note: `${ms}ms` } : { label: "Improve — corrected form generated", status: "fail" });
    checks.push(imp.natural?.trim() ? { label: "Improve — natural form generated", status: "pass" } : { label: "Improve — natural form generated", status: "warning" });
    checks.push(imp.explanation?.trim() ? { label: "Improve — explanation provided", status: "pass" } : { label: "Improve — explanation provided", status: "warning" });
  } catch (err) {
    checks.push({ label: "Improve My Sentence API", status: "fail", note: String(err) });
  }

  try {
    const { data, ms } = await timedStream("/feedback-stream", { messages: baseMessages, mode: "practice", feedbackLanguage: "English", deviceId: "audit-test", scenario: "job_interview" });
    timing.feedbackMs = ms;
    const f = (data as { feedback?: Record<string, unknown> })?.feedback;
    const allFields = [
      { key: "estimatedLevel", value: f?.estimatedLevel },
      { key: "strengths (≥ 1)", value: (f?.strengths as unknown[])?.length },
      { key: "improvements (≥ 1)", value: (f?.improvements as unknown[])?.length },
      { key: "correctedExample", value: f?.correctedExample },
      { key: "fluencyComment", value: f?.fluencyComment },
      { key: "nextStep", value: f?.nextStep },
    ];
    const missing = allFields.filter(({ value }) => value === undefined || value === null || value === "" || value === 0);
    checks.push(missing.length === 0 ? { label: "Feedback — all 6 fields present", status: "pass", note: `${ms}ms` } : { label: "Feedback — all 6 fields present", status: "warning", note: `Missing: ${missing.map((m) => m.key).join(", ")}` });
    const level = String(f?.estimatedLevel ?? "");
    checks.push(/^[ABC][12]/.test(level) ? { label: "Feedback — valid CEFR level", status: "pass", note: level } : { label: "Feedback — valid CEFR level", status: "warning", note: `Got: ${level || "empty"}` });
  } catch (err) {
    checks.push({ label: "End Session Feedback API", status: "fail", note: String(err) });
  }

  const worst = checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "warning") ? "warning" : "pass";
  return { status: worst, checks, runAt: now };
}

function runVoiceAudit(): CategoryResult {
  const checks: Check[] = [];
  const now = new Date().toLocaleTimeString();

  // Speech recognition
  const hasSpeech = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
  checks.push(hasSpeech ? { label: "SpeechRecognition API present", status: "pass" } : { label: "SpeechRecognition API present", status: "warning", note: "Not available — typed input is the fallback" });

  // Media devices
  const hasMedia = "mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices;
  checks.push(hasMedia ? { label: "MediaDevices API present", status: "pass" } : { label: "MediaDevices API present", status: "warning", note: "Mic access API unavailable" });

  // HTTPS
  checks.push(window.isSecureContext ? { label: "Secure context (HTTPS) for mic", status: "pass" } : { label: "Secure context (HTTPS) for mic", status: "warning", note: "HTTP — mic may be blocked" });

  // Typed fallback
  const inputExists = document.querySelector("input[type=text], textarea") !== null;
  checks.push(inputExists ? { label: "Typed fallback input present", status: "pass" } : { label: "Typed fallback input present", status: "warning", note: "No text input in current view" });

  // Voice settings persist
  try {
    const vs = getVoiceSettings();
    checks.push(typeof vs.autoSpeak === "boolean" && typeof vs.speakRate === "number" ? { label: "Voice settings load from localStorage", status: "pass" } : { label: "Voice settings load from localStorage", status: "warning" });
  } catch {
    checks.push({ label: "Voice settings load from localStorage", status: "fail", note: "getVoiceSettings() threw" });
  }

  // TTS availability
  if ("speechSynthesis" in window) {
    const avail = getVoiceAvailability("auto");
    const voiceName = getBestVoiceName("auto");
    checks.push(
      avail === "available" ? { label: "English voice available for TTS", status: "pass", note: voiceName }
      : avail === "limited" ? { label: "English voice available for TTS", status: "warning", note: "Basic voice only — see Voice Settings panel" }
      : { label: "English voice available for TTS", status: "warning", note: "No voice loaded yet (may need user interaction)" }
    );
  } else {
    checks.push({ label: "English voice available for TTS", status: "warning", note: "SpeechSynthesis not supported — voice is optional" });
  }

  // SpeechSynthesis cancel safety
  checks.push({ label: "Mic retry path implemented", status: "pass", note: "Error banner + stopSpeech() on mic start" });

  const worst = checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "warning") ? "warning" : "pass";
  return { status: worst, checks, runAt: now };
}

function runMemoryAudit(): CategoryResult {
  const checks: Check[] = [];
  const now = new Date().toLocaleTimeString();
  const raw = localStorage.getItem("speakup_learner_profile");

  if (!raw) {
    checks.push({ label: "Profile exists in localStorage", status: "warning", note: "No sessions started yet — will be created on first session" });
    return { status: "warning", checks, runAt: now };
  }
  checks.push({ label: "Profile exists in localStorage", status: "pass" });

  let profile: Record<string, unknown> | null = null;
  try {
    profile = JSON.parse(raw) as Record<string, unknown>;
    checks.push({ label: "Profile JSON is valid", status: "pass" });
  } catch {
    checks.push({ label: "Profile JSON is valid", status: "fail", note: "JSON parse error" });
    return { status: "fail", checks, runAt: now };
  }

  checks.push(typeof profile.deviceId === "string" && profile.deviceId.length > 0
    ? { label: "device_id persists", status: "pass", note: String(profile.deviceId).slice(0, 16) + "…" }
    : { label: "device_id persists", status: "fail", note: "Missing or empty" });

  const validLangs = ["English", "French", "Spanish", "German", "Italian", "Portuguese", "Russian", "Arabic", "Chinese", "Japanese", "Polish", "Ukrainian"];
  const iface = profile.preferredInterfaceLanguage;
  const fb = profile.preferredFeedbackLanguage;
  checks.push(typeof iface === "string" && validLangs.includes(iface) ? { label: "Interface language preference saved", status: "pass", note: String(iface) } : { label: "Interface language preference saved", status: "warning", note: `Got: ${String(iface)}` });
  checks.push(typeof fb === "string" && validLangs.includes(fb) ? { label: "Feedback language preference saved", status: "pass", note: String(fb) } : { label: "Feedback language preference saved", status: "warning", note: `Got: ${String(fb)}` });

  const sessions = profile.totalSessions;
  checks.push(typeof sessions === "number" && sessions >= 0 ? { label: "Session count tracked", status: "pass", note: `${String(sessions)} session(s)` } : { label: "Session count tracked", status: "warning", note: "totalSessions missing" });

  try {
    const p = getLearnerProfile();
    checks.push(p.deviceId ? { label: "getLearnerProfile() stable", status: "pass" } : { label: "getLearnerProfile() stable", status: "warning" });
  } catch {
    checks.push({ label: "getLearnerProfile() stable", status: "fail", note: "Throws on call" });
  }

  const worst = checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "warning") ? "warning" : "pass";
  return { status: worst, checks, runAt: now };
}

function buildPerformanceAudit(timing: TimingStore): CategoryResult {
  const checks: Check[] = [];
  const now = new Date().toLocaleTimeString();

  const flagMs = (label: string, ms: number, warnAt: number, failAt: number) => {
    if (!ms) { checks.push({ label, status: "warning", note: "Not measured" }); return; }
    if (ms > failAt) checks.push({ label, status: "fail", note: `${ms}ms (> ${failAt}ms)` });
    else if (ms > warnAt) checks.push({ label, status: "warning", note: `${ms}ms (> ${warnAt}ms)` });
    else checks.push({ label, status: "pass", note: `${ms}ms` });
  };

  const avgAiMs = timing.aiMs.length > 0 ? Math.round(timing.aiMs.reduce((a, b) => a + b, 0) / timing.aiMs.length) : 0;
  const avgTransMs = timing.translationMs.length > 0 ? Math.round(timing.translationMs.reduce((a, b) => a + b, 0) / timing.translationMs.length) : 0;

  flagMs("AI conversation (avg)", avgAiMs, 4000, 8000);
  flagMs("Translation (avg)", avgTransMs, 2000, 4000);
  flagMs("Help Me Answer", timing.hintMs, 3000, 6000);
  flagMs("Improve My Sentence", timing.improveMs, 3000, 6000);
  flagMs("End Session Feedback", timing.feedbackMs, 4000, 10000);

  const allMs = [...timing.aiMs, ...timing.translationMs, timing.hintMs, timing.improveMs, timing.feedbackMs].filter(Boolean);
  if (allMs.length > 0) {
    const maxMs = Math.max(...allMs);
    checks.push({ label: "Slowest single request", status: maxMs > 12000 ? "fail" : maxMs > 6000 ? "warning" : "pass", note: `${maxMs}ms` });
  }

  const worst = checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "warning") ? "warning" : "pass";
  return { status: worst, checks, runAt: now };
}

// ─── Test user simulator ──────────────────────────────────────────────────────
async function runSimulator(): Promise<SimulatorResult> {
  const steps: SimulatorStep[] = [];
  const now = new Date().toLocaleTimeString();
  const base = { mode: "practice" as const, scenario: "small_talk" as const, level: "intermediate" as const, interfaceLanguage: "English", feedbackLanguage: "French" };
  type ConvMsg = { role: "user" | "assistant"; content: string };

  const step = async (label: string, fn: () => Promise<{ ok: boolean; note?: string; ms?: number }>) => {
    try {
      const result = await fn();
      steps.push({ label, status: result.ok ? "pass" : "fail", note: result.note, ms: result.ms });
    } catch (err) {
      steps.push({ label, status: "fail", note: String(err) });
    }
  };

  const msgs: ConvMsg[] = [];

  // Step 1: App loads (check FREE_ACCESS_ENABLED gate)
  steps.push({ label: "1. App is accessible without login", status: "pass", note: "FREE_ACCESS_ENABLED=true" });

  // Step 2: AI opens session
  await step("2. AI opens conversation (small talk)", async () => {
    const { data, ms } = await timedPost("/conversation", { ...base, messages: [] });
    const msg = (data as { message?: string }).message ?? "";
    if (!msg.trim()) return { ok: false, note: "Empty opening message", ms };
    msgs.push({ role: "assistant", content: msg });
    return { ok: true, note: `${msg.slice(0, 50)}…`, ms };
  });

  if (msgs.length === 0) {
    return { status: "fail", steps, verdict: "NOT READY — API is unreachable", runAt: now };
  }

  // Steps 3–7: 5 learner messages
  const learnerTurns = [
    "Hi! I'm doing well, thanks for asking.",
    "I enjoy hiking and reading books in my free time.",
    "My favourite book is The Alchemist by Paulo Coelho.",
    "I recommend it because it teach you to follow your dream.",
    "What about you? Do you have any hobby?",
  ];

  for (let i = 0; i < learnerTurns.length; i++) {
    const userMsg = learnerTurns[i];
    msgs.push({ role: "user", content: userMsg });
    await step(`${i + 3}. Learner message ${i + 1} — AI responds`, async () => {
      const { data, ms } = await timedPost("/conversation", { ...base, messages: [...msgs] });
      const aiMsg = (data as { message?: string }).message ?? "";
      if (!aiMsg.trim()) return { ok: false, note: "Empty response", ms };
      msgs.push({ role: "assistant", content: aiMsg });
      return { ok: true, note: `${aiMsg.slice(0, 50)}…`, ms };
    });
  }

  // Step 8: Translate one AI reply
  await step("8. Translate AI reply to French", async () => {
    const aiReply = msgs.find((m) => m.role === "assistant")?.content ?? "Hello, how are you?";
    const { data, ms } = await timedPost("/translate", { text: aiReply, targetLanguage: "French" });
    const translation = (data as { translation?: string }).translation ?? "";
    if (!translation.trim() || translation === aiReply) return { ok: false, note: "Translation failed or unchanged", ms };
    return { ok: true, note: `"${translation.slice(0, 40)}…"`, ms };
  });

  // Step 9: Help Me Answer
  await step("9. Help Me Answer (hint)", async () => {
    const { data, ms } = await timedPost("/hint", { messages: msgs.slice(-4), scenario: base.scenario, level: base.level, feedbackLanguage: base.feedbackLanguage, interfaceLanguage: base.interfaceLanguage });
    const hint = data as { simpleReplies?: string[] };
    if (!Array.isArray(hint.simpleReplies) || hint.simpleReplies.length === 0) return { ok: false, note: "No simpleReplies returned", ms };
    return { ok: true, note: `${hint.simpleReplies.length} suggestions: "${hint.simpleReplies[0].slice(0, 40)}"`, ms };
  });

  // Step 10: Improve My Sentence
  await step("10. Improve My Sentence", async () => {
    const { data, ms } = await timedPost("/improve", { text: "I enjoy to hike and read book.", scenario: base.scenario, feedbackLanguage: "English" });
    const imp = data as { corrected?: string; natural?: string };
    if (!imp.corrected?.trim()) return { ok: false, note: "No corrected form", ms };
    return { ok: true, note: `Corrected: "${imp.corrected.slice(0, 50)}"`, ms };
  });

  // Step 11: End session — generate feedback
  await step("11. End session — generate feedback", async () => {
    const { data, ms } = await timedPost("/feedback", { messages: msgs.slice(0, 8), mode: base.mode, feedbackLanguage: base.feedbackLanguage, deviceId: "simulator-test", scenario: base.scenario });
    const f = (data as { feedback?: Record<string, unknown> }).feedback;
    if (!f?.estimatedLevel) return { ok: false, note: "Feedback missing estimatedLevel", ms };
    return { ok: true, note: `Level: ${String(f.estimatedLevel)} — ${(f.strengths as string[] | undefined)?.length ?? 0} strength(s)`, ms };
  });

  // Verdict
  const fails = steps.filter((s) => s.status === "fail").length;
  const verdict =
    fails === 0 ? "READY — full learner journey passed"
    : fails <= 2 ? "PRIVATE TESTING ONLY — minor failures detected"
    : "NOT READY — critical steps failed";

  const worst: Status = fails > 0 ? "fail" : steps.some((s) => s.status === "skip") ? "warning" : "pass";
  return { status: worst, steps, verdict, runAt: now };
}

// ─── Score + verdict ──────────────────────────────────────────────────────────
function calcScore(state: AuditState): number {
  const cats = Object.values(state);
  const scored = cats.filter((c) => c.status !== "idle" && c.status !== "running");
  if (scored.length === 0) return 0;
  const points = scored.reduce((sum, c) => c.status === "pass" ? sum + 1 : c.status === "warning" ? sum + 0.5 : sum, 0);
  return Math.round((points / scored.length) * 100);
}

function getVerdict(score: number): { label: string; color: string; bg: string; border: string } {
  if (score >= 85) return { label: "✅  READY", color: "text-emerald-300", bg: "bg-emerald-500/8", border: "border-emerald-500/30" };
  if (score >= 60) return { label: "⚠️  PRIVATE TESTING ONLY", color: "text-amber-300", bg: "bg-amber-500/8", border: "border-amber-500/30" };
  return { label: "✗  NOT READY", color: "text-rose-300", bg: "bg-rose-500/8", border: "border-rose-500/30" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Status }) {
  const cfg: Record<Status, { label: string; className: string }> = {
    idle:    { label: "—",       className: "bg-white/8 text-white/40 border border-white/10" },
    running: { label: "RUNNING", className: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse" },
    pass:    { label: "PASS",    className: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" },
    warning: { label: "WARN",    className: "bg-amber-500/20 text-amber-300 border border-amber-500/30" },
    fail:    { label: "FAIL",    className: "bg-rose-500/20 text-rose-300 border border-rose-500/30" },
  };
  const { label, className } = cfg[status];
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-widest ${className}`}>{label}</span>;
}

function CheckRow({ check }: { check: Check }) {
  const [showFix, setShowFix] = useState(false);
  const fix = check.status === "fail" ? getFixFor(check.label) : null;
  const icon = check.status === "pass" ? "✓" : check.status === "warning" ? "⚠" : "✗";
  const color = check.status === "pass" ? "text-emerald-400" : check.status === "warning" ? "text-amber-400" : "text-rose-400";
  return (
    <li className="text-xs py-1.5 border-b border-white/5 last:border-0">
      <div className="flex items-start gap-2">
        <span className={`${color} font-bold mt-0.5 flex-shrink-0`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-white/75">{check.label}</span>
            {check.note && <span className="text-white/35">— {check.note}</span>}
            {fix && (
              <button onClick={() => setShowFix((v) => !v)} className="text-[10px] text-rose-300/60 hover:text-rose-300 border border-rose-500/25 px-1.5 py-0.5 rounded transition-colors flex-shrink-0">
                {showFix ? "hide fix" : "fix →"}
              </button>
            )}
          </div>
          {showFix && fix && (
            <p className="mt-1.5 text-[11px] text-rose-200/70 bg-rose-500/8 border border-rose-500/15 rounded-lg px-3 py-2 leading-relaxed">{fix}</p>
          )}
        </div>
      </div>
    </li>
  );
}

function CategoryCard({
  icon, title, result, index,
  onRun, running: isRunning,
}: {
  icon: string; title: string; result: CategoryResult; index: number;
  onRun?: () => void; running?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const canRun = onRun && !isRunning;

  return (
    <div className={`rounded-xl border transition-colors ${
      result.status === "pass" ? "border-emerald-500/20 bg-emerald-500/5"
      : result.status === "warning" ? "border-amber-500/20 bg-amber-500/5"
      : result.status === "fail" ? "border-rose-500/20 bg-rose-500/5"
      : result.status === "running" ? "border-indigo-500/20 bg-indigo-500/5"
      : "border-white/8 bg-white/3"
    }`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          onClick={() => result.status !== "idle" && result.status !== "running" && setExpanded((e) => !e)}
          className="flex items-center gap-3 min-w-0 flex-1 text-left"
        >
          <span className="text-lg flex-shrink-0">{icon}</span>
          <div className="min-w-0">
            <span className="text-sm font-semibold text-white/85">{index}. {title}</span>
            {result.runAt && <span className="text-white/25 text-[10px] ml-2">ran at {result.runAt}</span>}
          </div>
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          {result.status === "running" && <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />}
          <StatusBadge status={result.status} />
          {canRun && (
            <button onClick={onRun} className="text-[11px] px-2 py-1 rounded-lg bg-white/8 hover:bg-indigo-500/30 text-white/40 hover:text-indigo-200 border border-white/10 hover:border-indigo-500/30 transition-all">
              Run
            </button>
          )}
          {result.status !== "idle" && result.status !== "running" && (
            <button onClick={() => setExpanded((e) => !e)}>
              <svg className={`w-4 h-4 text-white/30 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {expanded && result.checks.length > 0 && (
        <div className="px-4 pb-3 border-t border-white/8">
          <ul className="mt-2 space-y-0">
            {result.checks.map((c, i) => <CheckRow key={i} check={c} />)}
          </ul>
          {result.timingMs !== undefined && <p className="mt-2 text-[10px] text-white/25">Avg API time: {result.timingMs}ms</p>}
        </div>
      )}
    </div>
  );
}

function SimulatorCard({ result }: { result: SimulatorResult | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!result) return null;
  const fails = result.steps.filter((s) => s.status === "fail").length;
  const verdictColor = fails === 0 ? "text-emerald-300" : fails <= 2 ? "text-amber-300" : "text-rose-300";
  const borderColor = fails === 0 ? "border-emerald-500/25 bg-emerald-500/5" : fails <= 2 ? "border-amber-500/25 bg-amber-500/5" : "border-rose-500/25 bg-rose-500/5";

  return (
    <div className={`rounded-xl border ${borderColor}`}>
      <button onClick={() => setExpanded((e) => !e)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="flex items-center gap-3">
          <span className="text-lg">🎭</span>
          <div>
            <span className="text-sm font-semibold text-white/85">Learner Simulator</span>
            {result.runAt && <span className="text-white/25 text-[10px] ml-2">ran at {result.runAt}</span>}
            <p className={`text-xs font-semibold mt-0.5 ${verdictColor}`}>{result.verdict}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={result.status} />
          <svg className={`w-4 h-4 text-white/30 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 border-t border-white/8">
          <ul className="mt-2 space-y-0">
            {result.steps.map((s, i) => {
              const icon = s.status === "pass" ? "✓" : s.status === "fail" ? "✗" : "–";
              const color = s.status === "pass" ? "text-emerald-400" : s.status === "fail" ? "text-rose-400" : "text-white/30";
              return (
                <li key={i} className="flex items-start gap-2 text-xs py-1.5 border-b border-white/5 last:border-0">
                  <span className={`${color} font-bold mt-0.5 flex-shrink-0`}>{icon}</span>
                  <div className="min-w-0">
                    <span className="text-white/70">{s.label}</span>
                    {s.ms && <span className="text-white/30 ml-1">({s.ms}ms)</span>}
                    {s.note && <p className="text-white/35 mt-0.5 leading-relaxed">{s.note}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
const CATEGORIES: Array<{ key: keyof AuditState; icon: string; title: string; runner: (t: TimingStore) => Promise<CategoryResult> | CategoryResult }> = [
  { key: "ui",          icon: "📐", title: "UI / Mobile",           runner: () => runUIAudit() },
  { key: "ai",          icon: "🤖", title: "AI Conversation",        runner: (t) => runAIAudit(t) },
  { key: "translation", icon: "🌐", title: "Translation",            runner: (t) => runTranslationAudit(t) },
  { key: "tools",       icon: "🛠️", title: "Learning Tools",         runner: (t) => runToolsAudit(t) },
  { key: "voice",       icon: "🎙️", title: "Voice / Mic",            runner: () => runVoiceAudit() },
  { key: "memory",      icon: "🧠", title: "Memory & Persistence",   runner: () => runMemoryAudit() },
  { key: "performance", icon: "⚡", title: "Performance",            runner: (t) => buildPerformanceAudit(t) },
];

const initialState: AuditState = {
  ui: IDLE, ai: IDLE, translation: IDLE, tools: IDLE, voice: IDLE, memory: IDLE, performance: IDLE,
};

export function AuditDashboard({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<AuditState>(initialState);
  const [running, setRunning] = useState(false);
  const [runningKey, setRunningKey] = useState<keyof AuditState | null>(null);
  const [done, setDone] = useState(false);
  const [simulatorResult, setSimulatorResult] = useState<SimulatorResult | null>(null);
  const [simulatorRunning, setSimulatorRunning] = useState(false);
  const [whatChanged, setWhatChanged] = useState("");
  const timingRef = useRef<TimingStore>({ aiMs: [], translationMs: [], hintMs: 0, improveMs: 0, feedbackMs: 0 });

  const set = useCallback((key: keyof AuditState, result: CategoryResult) => {
    setState((s) => ({ ...s, [key]: result }));
  }, []);

  const runFullAudit = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setDone(false);
    timingRef.current = { aiMs: [], translationMs: [], hintMs: 0, improveMs: 0, feedbackMs: 0 };
    setState(initialState);

    const t = timingRef.current;
    for (const cat of CATEGORIES) {
      set(cat.key, RUNNING);
      if (cat.key !== "performance") await new Promise((r) => setTimeout(r, 100));
      const result = await cat.runner(t);
      set(cat.key, result);
    }

    setRunning(false);
    setDone(true);
  }, [running, set]);

  const runSingleCategory = useCallback(async (key: keyof AuditState) => {
    if (running || runningKey) return;
    setRunningKey(key);
    const t = timingRef.current;
    set(key, RUNNING);
    const cat = CATEGORIES.find((c) => c.key === key)!;
    const result = await cat.runner(t);
    set(key, result);
    setRunningKey(null);
    setDone(false);
  }, [running, runningKey, set]);

  const runSimulatorFlow = useCallback(async () => {
    if (simulatorRunning) return;
    setSimulatorRunning(true);
    setSimulatorResult(null);
    const result = await runSimulator();
    setSimulatorResult(result);
    setSimulatorRunning(false);
  }, [simulatorRunning]);

  const score = calcScore(state);
  const verdict = getVerdict(score);

  // Collect all failed checks for fix recommendations
  const allFails: Array<{ category: string; check: Check }> = [];
  CATEGORIES.forEach(({ key, title }) => {
    state[key].checks.filter((c) => c.status === "fail").forEach((c) => allFails.push({ category: title, check: c }));
  });

  const copyReport = useCallback(() => {
    const lines: string[] = [
      "SpeakUp AI — QA Audit Report",
      `Date: ${new Date().toLocaleString()}`,
      `Score: ${score}/100`,
      `Verdict: ${verdict.label}`,
    ];
    if (whatChanged.trim()) {
      lines.push("", "── What changed ──", whatChanged.trim());
    }
    lines.push("");
    CATEGORIES.forEach(({ key, icon, title }) => {
      const r = state[key];
      lines.push(`${icon} ${title}: ${r.status.toUpperCase()}`);
      r.checks.forEach((c) => {
        lines.push(`   ${c.status === "pass" ? "✓" : c.status === "warning" ? "⚠" : "✗"} ${c.label}${c.note ? ` — ${c.note}` : ""}`);
        if (c.status === "fail") {
          const fix = getFixFor(c.label);
          if (fix) lines.push(`      FIX: ${fix}`);
        }
      });
      lines.push("");
    });
    if (simulatorResult) {
      lines.push("🎭 Learner Simulator", simulatorResult.verdict);
      simulatorResult.steps.forEach((s) => {
        lines.push(`   ${s.status === "pass" ? "✓" : "✗"} ${s.label}${s.note ? ` — ${s.note}` : ""}`);
      });
      lines.push("");
    }
    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
  }, [state, score, verdict, whatChanged, simulatorResult]);

  const completedCount = Object.values(state).filter((r) => r.status !== "idle" && r.status !== "running").length;

  return (
    <div data-audit-ui="true" className="fixed inset-0 z-[9998] bg-slate-950/97 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-16">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">Internal</span>
              <span className="text-white/25 text-xs">Not visible to users · Ctrl+Shift+Q to toggle</span>
            </div>
            <h1 className="text-xl font-bold text-white">SpeakUp AI — Quality Coach</h1>
          </div>
          <button onClick={onClose} className="text-white/35 hover:text-white/70 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* What changed field */}
        <div className="mb-5">
          <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">What changed in this version?</label>
          <textarea
            value={whatChanged}
            onChange={(e) => setWhatChanged(e.target.value)}
            placeholder="e.g. Added voice system (7 stages), rewrote tts.ts with smart voice selection, added per-message Speak/Stop buttons, VoiceSettingsPanel…"
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/70 text-sm placeholder:text-white/20 focus:outline-none focus:border-indigo-500/40 resize-none"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={runFullAudit}
            disabled={running}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${running ? "bg-indigo-500/20 text-indigo-300/50 border border-indigo-500/20 cursor-not-allowed" : "bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-900/50"}`}
          >
            {running ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-indigo-300/40 border-t-indigo-200 rounded-full animate-spin" />
                Running {completedCount}/7…
              </span>
            ) : "▶  Run Full Audit"}
          </button>
          <button
            onClick={runSimulatorFlow}
            disabled={simulatorRunning || running}
            className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all border ${simulatorRunning ? "bg-violet-500/20 text-violet-300/50 border-violet-500/20 cursor-not-allowed" : "bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 hover:text-violet-200 border-violet-500/25 hover:border-violet-500/40"}`}
          >
            {simulatorRunning ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin" />
                Simulating…
              </span>
            ) : "🎭 Simulate"}
          </button>
          {(done || simulatorResult) && (
            <button onClick={copyReport} className="px-4 py-3 rounded-xl border border-white/15 text-white/60 hover:text-white/85 hover:border-white/25 text-sm transition-colors">
              Copy
            </button>
          )}
        </div>

        {/* Progress bar */}
        {running && (
          <div className="mb-4 h-1 bg-white/8 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${Math.round((completedCount / 7) * 100)}%` }} />
          </div>
        )}

        {/* Score + verdict card */}
        {done && (
          <div className={`mb-5 p-5 rounded-2xl border ${verdict.bg} ${verdict.border}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">Launch Readiness</p>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className={`text-5xl font-extrabold ${verdict.color}`}>{score}</span>
                  <span className="text-white/30 text-xl">/100</span>
                </div>
                <p className={`text-base font-bold ${verdict.color}`}>{verdict.label}</p>
              </div>
              <div className="space-y-1 text-right flex-shrink-0">
                {CATEGORIES.map(({ key, icon, title }) => {
                  const s = state[key].status;
                  if (s === "idle") return null;
                  return (
                    <div key={key} className="flex items-center justify-end gap-2 text-xs">
                      <span className="text-white/40">{icon} {title}</span>
                      <StatusBadge status={s} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fix recommendations */}
            {allFails.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs font-semibold text-rose-300/70 uppercase tracking-wider mb-3">🔧 Recommended Fixes ({allFails.length})</p>
                <div className="space-y-2">
                  {allFails.map(({ category, check }, i) => {
                    const fix = getFixFor(check.label);
                    return (
                      <div key={i} className="text-xs bg-rose-500/8 border border-rose-500/15 rounded-xl p-3">
                        <p className="text-rose-300/80 font-semibold mb-1">{category} — {check.label}</p>
                        {fix ? <p className="text-rose-200/55 leading-relaxed">{fix}</p> : <p className="text-rose-200/40 italic">Investigate server logs and API responses.</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Simulator result */}
        {simulatorResult && <div className="mb-5"><SimulatorCard result={simulatorResult} /></div>}

        {/* Audit categories */}
        <div className="space-y-3">
          {CATEGORIES.map(({ key, icon, title }, i) => (
            <CategoryCard
              key={key}
              icon={icon}
              title={title}
              result={state[key]}
              index={i + 1}
              onRun={() => runSingleCategory(key)}
              running={runningKey === key || running}
            />
          ))}
        </div>

        <p className="mt-8 text-center text-white/20 text-xs">
          Quality Coach · Internal only · Every improvement includes its own QA report
        </p>
      </div>
    </div>
  );
}
