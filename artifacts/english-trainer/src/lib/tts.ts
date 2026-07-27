import type { AccentPref } from "./voiceSettings";

export interface SpeakOptions {
  accent?: AccentPref;
  rate?: number;
  voiceURI?: string;
  onEnd?: () => void;
}

export type VoiceAvailability = "available" | "limited" | "unavailable";

export interface EnglishVoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
  default: boolean;
  score: number;
}

// ─── Module-level state ───────────────────────────────────────────────────────
let _lastText = "";
let _lastOptions: SpeakOptions = {};
let _currentUtterance: SpeechSynthesisUtterance | null = null;
let _keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let _warmedUp = false;
let _gestureUnlockDone = false;

// ─── Keep-alive (Chrome GC bug: speechSynthesis goes silent after ~15s) ───────
function startKeepAlive(): void {
  stopKeepAlive();
  _keepAliveTimer = setInterval(() => {
    if (!("speechSynthesis" in window) || !window.speechSynthesis.speaking) {
      stopKeepAlive();
      return;
    }
    try {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    } catch {
      stopKeepAlive();
    }
  }, 10_000);
}

function stopKeepAlive(): void {
  if (_keepAliveTimer !== null) {
    clearInterval(_keepAliveTimer);
    _keepAliveTimer = null;
  }
}

// ─── Robotic / novelty voice blocklist ───────────────────────────────────────
// These are macOS novelty voices, known robotic engines, and joke voices that
// should never be selected when any real voice is available.
const ROBOTIC_BLOCKLIST = [
  "espeak", "fred", "albert", "zarvox", "bad guy", "cellos",
  "deranged", "hysterical", "junior", "kathy", "pipe organ",
  "princess", "whisper", "bells", "boing", "bubbles", "jester",
];

function isRoboticVoice(voice: SpeechSynthesisVoice): boolean {
  const n = voice.name.toLowerCase();
  return ROBOTIC_BLOCKLIST.some((b) => n.includes(b));
}

// ─── Voice scoring ────────────────────────────────────────────────────────────
// Priority tiers (per audit spec):
//   Tier 1 (+60): Google voices         — best free quality, Chrome / Android
//   Tier 2 (+50): Microsoft Natural/Online — best on Edge / Windows
//   Tier 3 (+45): Apple Siri / (Premium) voices — Safari / macOS / iOS
//   Tier 4 (+40): Apple (Enhanced) / HD / named Apple quality voices
//   Tier 5 (+35): WaveNet / Neural / Studio (other platforms)
//   Tier 6 (+20): Any other cloud (localService: false)
//   Tier 7 (  0): Local fallback
// Robotic / novelty voices → -999 (excluded entirely)
function scoreVoice(voice: SpeechSynthesisVoice, accent: AccentPref): number {
  if (isRoboticVoice(voice)) return -999;
  const lang = voice.lang.toLowerCase();
  if (!lang.startsWith("en")) return -999;

  let score = 0;

  // Language / accent match
  if (accent === "british") {
    if (lang === "en-gb") score += 100;
    else if (lang === "en-au" || lang === "en-nz" || lang === "en-ie") score += 25;
    else if (lang === "en-in") score += 10;
    else score += 2;
  } else if (accent === "american") {
    if (lang === "en-us") score += 100;
    else if (lang === "en-ca") score += 25;
    else score += 2;
  } else {
    // auto
    if (lang === "en-us" || lang === "en-gb") score += 60;
    else score += 40;
  }

  const name = voice.name.toLowerCase();

  // Tier 1: Google voices (e.g. "Google UK English Female")
  if (name.startsWith("google")) {
    score += 60;
    return score;
  }

  // Tier 2: Microsoft Natural / Online voices
  if (name.includes("microsoft") && (name.includes("natural") || name.includes("online"))) {
    score += 50;
    return score;
  }

  // Tier 3a: Siri voices
  if (name.includes("siri")) { score += 45; return score; }

  // Tier 3b: Apple (Premium) label
  if (name.includes("(premium)")) { score += 45; return score; }

  // Tier 4a: Apple (Enhanced) / HD / named Apple quality voices
  if (name.includes("(enhanced)") || name.includes(" hd") || name.includes("-hd")) {
    score += 40; return score;
  }

  // Tier 4b: Named Microsoft voices known for quality
  if (
    name.includes("microsoft aria") || name.includes("microsoft jenny") ||
    name.includes("microsoft ryan") || name.includes("microsoft sonia") ||
    name.includes("microsoft guy")
  ) { score += 40; return score; }

  // Tier 4c: Named Apple quality voices (macOS system voices)
  const APPLE_NAMES = ["daniel", "kate", "serena", "martha", "samantha", "alex", "tom", "karen", "moira", "tessa", "veena"];
  if (APPLE_NAMES.some((n) => name.includes(n))) { score += 35; return score; }

  // Tier 5: Other quality keywords
  if (name.includes("neural") || name.includes("wavenet") || name.includes("studio")) { score += 35; return score; }
  if (name.includes("natural")) { score += 30; return score; }

  // Tier 6: Any other cloud voice
  if (!voice.localService) { score += 20; return score; }

  // Tier 7: Local voices — misc boosts only
  if (name.includes("microsoft")) score += 5;
  if (voice.default) score += 3;

  return score;
}

// ─── Voice selection helpers ──────────────────────────────────────────────────
function selectBestVoice(
  accent: AccentPref,
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  return voices
    .map((v) => ({ voice: v, score: scoreVoice(v, accent) }))
    .filter(({ score }) => score > -900)
    .sort((a, b) => b.score - a.score)[0]?.voice ?? null;
}

export function getEnglishVoices(accent: AccentPref = "auto"): EnglishVoiceOption[] {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("en") && !isRoboticVoice(v))
    .map((v) => ({
      name: v.name,
      lang: v.lang,
      voiceURI: v.voiceURI,
      localService: v.localService,
      default: v.default,
      score: scoreVoice(v, accent),
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Returns the top N English voices for the voice picker UI.
 * Deduplicates by short-name prefix so platform variants of the same voice
 * (e.g. "Microsoft Sonia" vs "Microsoft Sonia Online (Natural) - English (UK)")
 * don't fill all slots.
 */
export function getTopVoices(accent: AccentPref = "auto", count = 5): EnglishVoiceOption[] {
  const all = getEnglishVoices(accent);
  const seen = new Set<string>();
  const result: EnglishVoiceOption[] = [];
  for (const v of all) {
    const key = v.name.split(/\s+/).slice(0, 3).join(" ").toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(v);
    }
    if (result.length >= count) break;
  }
  return result;
}

// ─── Debug helper ─────────────────────────────────────────────────────────────
/**
 * Logs all available voices with name, lang, localService, default, score and
 * blocked flag to the browser console.  Waits for 'voiceschanged' on Chrome.
 */
export function debugLogVoices(): void {
  if (!("speechSynthesis" in window)) {
    console.warn("[TTS] speechSynthesis not available in this browser");
    return;
  }
  const log = () => {
    const voices = window.speechSynthesis.getVoices();
    console.group(`[TTS] ${voices.length} voices available`);
    console.table(
      voices.map((v) => ({
        name: v.name,
        lang: v.lang,
        localService: v.localService,
        default: v.default,
        score: scoreVoice(v, "auto"),
        blocked: isRoboticVoice(v),
      })),
    );
    const best = selectBestVoice("auto", voices);
    console.info("[TTS] Best voice (auto):", best?.name ?? "none");
    console.groupEnd();
  };
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) { log(); return; }
  // Chrome: voices load async, must wait for voiceschanged
  window.speechSynthesis.addEventListener("voiceschanged", log, { once: true });
  setTimeout(log, 1200); // fallback for browsers that never fire voiceschanged
}

// ─── Text cleaning + pronunciation normalisation ──────────────────────────────
// ─── Ordinal / currency expansion ────────────────────────────────────────────
const ORDINAL_WORDS = [
  "zeroth","first","second","third","fourth","fifth","sixth","seventh","eighth",
  "ninth","tenth","eleventh","twelfth","thirteenth","fourteenth","fifteenth",
  "sixteenth","seventeenth","eighteenth","nineteenth","twentieth",
  "twenty-first","twenty-second","twenty-third","twenty-fourth","twenty-fifth",
  "twenty-sixth","twenty-seventh","twenty-eighth","twenty-ninth","thirtieth","thirty-first",
];

function toOrdinalWord(n: number): string {
  return ORDINAL_WORDS[n] ?? `${n}th`;
}

function expandCurrencyAndOrdinals(text: string): string {
  return text
    // £N.NN — pounds and pence
    .replace(/£(\d+)\.(\d{2})/g, (_, lbs, pen) => {
      const p = parseInt(pen, 10);
      return `${lbs} pound${lbs === "1" ? "" : "s"}${p > 0 ? ` and ${p} pence` : ""}`;
    })
    .replace(/£(\d+)/g, (_, n) => `${n} pound${n === "1" ? "" : "s"}`)
    // €N.NN — euros and cents
    .replace(/€(\d+)\.(\d{2})/g, (_, eur, cts) => {
      const c = parseInt(cts, 10);
      return `${eur} euro${eur === "1" ? "" : "s"}${c > 0 ? ` and ${c} cent${c === 1 ? "" : "s"}` : ""}`;
    })
    .replace(/€(\d+)/g, (_, n) => `${n} euro${n === "1" ? "" : "s"}`)
    // $N.NN — dollars and cents
    .replace(/\$(\d+)\.(\d{2})/g, (_, dol, cts) => {
      const c = parseInt(cts, 10);
      return `${dol} dollar${dol === "1" ? "" : "s"}${c > 0 ? ` and ${c} cent${c === 1 ? "" : "s"}` : ""}`;
    })
    .replace(/\$(\d+)/g, (_, n) => `${n} dollar${n === "1" ? "" : "s"}`)
    // Ordinals: 1st, 2nd, 3rd, 4th … 31st
    .replace(/\b(\d+)(?:st|nd|rd|th)\b/g, (_, n) => toOrdinalWord(parseInt(n, 10)));
}

const ABBREV_EXPANSIONS: Array<[RegExp, string]> = [
  [/\bMr\./g,    "Mister"],
  [/\bMrs\./g,   "Missus"],
  [/\bMs\./g,    "Miss"],
  [/\bDr\./g,    "Doctor"],
  [/\bProf\./g,  "Professor"],
  [/\bSt\./g,    "Saint"],
  [/\bAve\./g,   "Avenue"],
  [/\bDept\./g,  "Department"],
  [/\be\.g\./gi, "for example"],
  [/\bi\.e\./gi, "that is"],
  [/\betc\./g,   "etcetera"],
  [/\bvs\./g,    "versus"],
  [/\bapprox\./g,"approximately"],
  [/\bNo\.\s*(\d)/g, "Number $1"],
];

function cleanText(text: string): string {
  let t = text
    // Strip markdown code blocks and inline code
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    // Strip markdown formatting
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/>\s/g, "")
    .replace(/[-*+]\s/g, "")
    .replace(/\d+\.\s/g, "")
    .replace(/[_~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Strip emoji and special Unicode symbols
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27FF}]/gu, "")
    .replace(/[\u{FE00}-\u{FEFF}]/gu, "")
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "");

  // Expand currency symbols and ordinal suffixes before abbreviations
  t = expandCurrencyAndOrdinals(t);

  // Expand abbreviations that TTS engines mispronounce
  for (const [re, replacement] of ABBREV_EXPANSIONS) {
    t = t.replace(re, replacement);
  }

  return t.replace(/\s+/g, " ").trim();
}

// ─── Sentence chunker (Chrome truncation workaround) ─────────────────────────
// Chrome (especially on Android) silently cuts utterances off at ~200 chars.
const MAX_TTS_CHUNK = 200;

// commaEnd=true triggers a 65ms inter-chunk pause for natural breathing room.
interface TextChunk { text: string; commaEnd: boolean; }

function splitIntoChunks(text: string): TextChunk[] {
  // Pass 1: split at sentence boundaries (.!?) respecting MAX_TTS_CHUNK
  const segments = text.match(/[^.!?]+[.!?]*(?:\s+|$)/g) ?? [text];
  const merged: string[] = [];
  let current = "";
  for (const seg of segments) {
    const s = seg.trim();
    if (!s) continue;
    if ((current ? current.length + 1 + s.length : s.length) <= MAX_TTS_CHUNK) {
      current = current ? `${current} ${s}` : s;
    } else {
      if (current) merged.push(current);
      if (s.length > MAX_TTS_CHUNK) {
        for (let i = 0; i < s.length; i += MAX_TTS_CHUNK) merged.push(s.slice(i, i + MAX_TTS_CHUNK));
        current = "";
      } else {
        current = s;
      }
    }
  }
  if (current) merged.push(current);

  // Pass 2: split each sentence chunk at commas for natural prosodic pauses
  const chunks: TextChunk[] = [];
  for (const m of (merged.length ? merged : [text.slice(0, MAX_TTS_CHUNK)])) {
    const parts = m.split(/,\s+/);
    parts.forEach((p, i) => {
      const t = p.trim();
      if (!t) return;
      const isCommaEnd = i < parts.length - 1;
      chunks.push({ text: isCommaEnd ? t + "," : t, commaEnd: isCommaEnd });
    });
  }
  return chunks.length ? chunks : [{ text: text.slice(0, MAX_TTS_CHUNK), commaEnd: false }];
}

// ─── iOS / Safari gesture unlock ─────────────────────────────────────────────
/**
 * Registers a one-time document event listener that fires `warmUpTts()` on the
 * first user interaction (click / touchstart / keydown).  Call this on mount.
 * iOS Safari requires speechSynthesis.speak() to be in a user-gesture callstack,
 * so a warm-up utterance triggered from an effect alone won't work — this
 * defers it to the first actual touch/click.
 */
export function unlockTtsOnGesture(): void {
  if (_gestureUnlockDone || !("speechSynthesis" in window)) return;
  const events = ["click", "touchstart", "keydown"] as const;
  const handler = () => {
    if (_gestureUnlockDone) return;
    _gestureUnlockDone = true;
    warmUpTts();
    events.forEach((e) => document.removeEventListener(e, handler, true));
  };
  events.forEach((e) =>
    document.addEventListener(e, handler, { capture: true, passive: true }),
  );
}

// ─── Warm-up ──────────────────────────────────────────────────────────────────
export function warmUpTts(): void {
  if (_warmedUp || !("speechSynthesis" in window)) return;
  _warmedUp = true;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    u.rate = 1;
    window.speechSynthesis.speak(u);
    setTimeout(() => {
      if (!_currentUtterance) window.speechSynthesis.cancel();
    }, 100);
  } catch {
    // Silently ignore — not a hard requirement
  }
}

// ─── Availability & auto-selection ───────────────────────────────────────────
export function getVoiceAvailability(accent: AccentPref = "auto"): VoiceAvailability {
  if (isPremiumVoiceActive()) return "available";
  if (!("speechSynthesis" in window)) return "unavailable";
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return "available"; // voices not yet loaded — optimistic
  const best = selectBestVoice(accent, voices);
  if (!best) return "unavailable";
  const s = scoreVoice(best, accent);
  if (s >= 50) return "available";
  if (s >= 0) return "limited";
  return "unavailable";
}

export function getBestVoiceName(accent: AccentPref = "auto"): string {
  if (!("speechSynthesis" in window)) return "Not supported";
  const voices = window.speechSynthesis.getVoices();
  const best = selectBestVoice(accent, voices);
  return best ? `${best.name} (${best.lang})` : "No English voice found";
}

/**
 * Returns the voiceURI of the best available English voice for the given accent.
 * Returns "" when the voice list has not yet loaded.
 */
export function autoSelectVoiceURI(accent: AccentPref = "auto"): string {
  if (!("speechSynthesis" in window)) return "";
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return "";
  const best = selectBestVoice(accent, voices);
  if (!best) return "";
  if (import.meta.env.DEV) {
    console.info(`[TTS] Auto-selected: ${best.name} (${best.lang}) score=${scoreVoice(best, accent)}`);
  }
  return best.voiceURI;
}

// ─── Web Speech synthesis (fallback path) ────────────────────────────────────
function speakWeb(text: string, options: SpeakOptions = {}): void {
  if (!("speechSynthesis" in window)) {
    options.onEnd?.();
    return;
  }
  const cleaned = cleanText(text);
  if (!cleaned) {
    options.onEnd?.();
    return;
  }
  _lastText = cleaned;
  _lastOptions = options;
  stopKeepAlive();
  window.speechSynthesis.cancel();
  _currentUtterance = null;

  const chunks = splitIntoChunks(cleaned);
  let chunkIdx = 0;
  let aborted = false;

  const finish = () => {
    if (aborted) return;
    aborted = true;
    _currentUtterance = null;
    stopKeepAlive();
    options.onEnd?.();
  };

  const speakChunk = (voices: SpeechSynthesisVoice[]) => {
    if (aborted) return;
    if (chunkIdx >= chunks.length) { finish(); return; }
    const { text: chunk, commaEnd } = chunks[chunkIdx++];
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = "en-US";
    utterance.rate = options.rate ?? 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    const chosen = options.voiceURI
      ? (voices.find((v) => v.voiceURI === options.voiceURI) ?? selectBestVoice(options.accent ?? "auto", voices))
      : selectBestVoice(options.accent ?? "auto", voices);
    if (chosen) {
      utterance.voice = chosen;
      utterance.lang = chosen.lang;
    }
    // Comma-end chunks get a 65ms pause to simulate natural breathing room.
    utterance.onend = () => {
      if (commaEnd) {
        setTimeout(() => speakChunk(voices), 65);
      } else {
        speakChunk(voices);
      }
    };
    utterance.onerror = (e) => {
      if (e.error !== "interrupted" && e.error !== "canceled") {
        speakChunk(voices); // skip chunk and continue
      } else {
        aborted = true;
        _currentUtterance = null;
        stopKeepAlive();
      }
    };
    _currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    startKeepAlive();
  };

  // Small delay to let cancel() settle before speaking the first chunk
  setTimeout(() => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      speakChunk(voices);
    } else {
      window.speechSynthesis.addEventListener(
        "voiceschanged",
        () => speakChunk(window.speechSynthesis.getVoices()),
        { once: true },
      );
    }
  }, 50);
}

// ─── Premium (OpenAI) voice ───────────────────────────────────────────────────
// Natural server-side TTS via /api/tts. speak() prefers this and falls back to
// Web Speech automatically if the route is unavailable in this session.
let _premiumEnabled = true;
let _premiumState: "unknown" | "ok" | "unavailable" = "unknown";
let _premiumAudio: HTMLAudioElement | null = null;
const _premiumCache = new Map<string, string>(); // key -> object URL

export function setPremiumVoiceEnabled(on: boolean): void {
  _premiumEnabled = on;
  if (!on) stopPremiumAudio();
}
export function isPremiumVoiceEnabled(): boolean { return _premiumEnabled; }
export function isPremiumVoiceActive(): boolean {
  return _premiumEnabled && _premiumState !== "unavailable";
}

function stopPremiumAudio(): void {
  if (_premiumAudio) {
    _premiumAudio.onended = null;
    _premiumAudio.onerror = null;
    _premiumAudio.onplaying = null;
    try { _premiumAudio.pause(); } catch { /* ignore */ }
    _premiumAudio = null;
  }
}

async function fetchPremiumAudio(text: string, accent: AccentPref, slow: boolean): Promise<string> {
  const key = `${accent}|${slow ? "s" : "n"}|${text}`;
  const cached = _premiumCache.get(key);
  if (cached) return cached;
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, accent, slow }),
  });
  if (!res.ok) throw new Error(`tts ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  if (_premiumCache.size >= 40) {
    const first = _premiumCache.keys().next().value;
    if (first) { URL.revokeObjectURL(_premiumCache.get(first)!); _premiumCache.delete(first); }
  }
  _premiumCache.set(key, url);
  return url;
}

// Resolves on natural end (or a mid-playback error, treated as "done").
// Rejects only when playback never started, so the caller can fall back.
async function speakPremium(text: string, options: SpeakOptions): Promise<void> {
  const cleaned = cleanText(text);
  if (!cleaned) { options.onEnd?.(); return; }
  const accent = options.accent ?? "auto";
  const slow = (options.rate ?? 0.95) <= 0.8;
  const url = await fetchPremiumAudio(cleaned, accent, slow); // pre-playback throw → fallback

  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  stopPremiumAudio();

  _lastText = cleaned;
  _lastOptions = options;

  const audio = new Audio(url);
  _premiumAudio = audio;
  let started = false;
  const clear = () => { if (_premiumAudio === audio) _premiumAudio = null; };

  await new Promise<void>((resolve, reject) => {
    audio.onplaying = () => { started = true; };
    audio.onended = () => { clear(); options.onEnd?.(); resolve(); };
    audio.onerror = () => {
      clear();
      if (started) { options.onEnd?.(); resolve(); }
      else reject(new Error("audio play error"));
    };
    audio.play().then(() => { started = true; }).catch((e) => {
      if (!started) { clear(); reject(e); }
    });
  });
}

// ─── Main speak() — premium first, Web Speech fallback ───────────────────────
export function speak(text: string, options: SpeakOptions = {}): void {
  if (_premiumEnabled && _premiumState !== "unavailable") {
    speakPremium(text, options)
      .then(() => { _premiumState = "ok"; })
      .catch(() => {
        // Only disable for the session if premium never worked (setup/network).
        if (_premiumState !== "ok") _premiumState = "unavailable";
        speakWeb(text, options);
      });
    return;
  }
  speakWeb(text, options);
}

export function stopSpeech(): void {
  stopPremiumAudio();
  if (!("speechSynthesis" in window)) return;
  stopKeepAlive();
  _currentUtterance = null;
  window.speechSynthesis.cancel();
}

export function replayLastSpeech(options?: SpeakOptions): void {
  if (_lastText) speak(_lastText, { ..._lastOptions, ...options });
}

/** Re-speak the last utterance at a learner-friendly slow rate (0.7). */
export function replayLastSlow(): void {
  if (_lastText) speak(_lastText, { ..._lastOptions, rate: 0.7 });
}

export function isSpeaking(): boolean {
  if (_premiumAudio && !_premiumAudio.paused) return true;
  if (!("speechSynthesis" in window)) return false;
  return window.speechSynthesis.speaking;
}

