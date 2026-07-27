# SpeakUp AI — Internal Launch Audit
**Date:** 2026-05-03  
**Auditors (roles):** Senior PM · Senior UX Auditor · Senior Mobile QA Engineer · Senior AI Conversation Designer · Senior Conversion Strategist  
**Codebase reviewed:** Full source — `ConversationView.tsx`, `HomeView.tsx`, `SessionSetupView.tsx`, `FeedbackView.tsx`, `trainer.ts`, `tts.ts`, `useSpeechRecognition.ts`, `VoiceSettingsPanel.tsx`, `learnerMemory.ts`, `AppContext.tsx`, `translations.ts`

---

## 1. FIRST IMPRESSION
**Verdict: WARNING**

- **Evidence:** The hero headline is "Professional AI English Coaching" — generic, not differentiated. The subheadline repeats the headline with different words instead of delivering a distinct second hook.
- **Evidence:** The feature pills at the bottom — "12 languages", "30 scenarios", "3 coaching modes" — are raw counts with no emotional meaning. Numbers without context do not convert.
- **Evidence:** "by Antony Addy" appears twice on the home screen (header + creator card). One is in `text-white/25` (barely visible); both together consume screen space without building trust that a first-time visitor can act on.
- **Evidence:** No social proof, no sample interaction, no example of what the AI actually says. Users are asked to trust entirely on claims.
- **Evidence:** The `premiumComingLater` copy ("Premium plans coming later") is visible on the home screen. Telling users that a free thing will eventually cost money before they have experienced value is a conversion risk.

---

## 2. MOBILE EXPERIENCE
**Verdict: WARNING**

- **Evidence:** `ConversationView.tsx` uses `pb-safe pb-4` — on Safari iOS, if the safe-area environment variable is not injected by the meta viewport tag, `pb-safe` falls back to 0 and the bottom input area collides with the home indicator bar. The `viewport` meta tag is not audited here but is a known iOS webview failure point.
- **Evidence:** The hint panel and improve panel appear as `flex-shrink-0` blocks inside the flex column, above the input area. On a 375×667 screen (iPhone SE), a long hint response + message history + input bar will overflow the visible viewport and require the user to scroll in two different directions. There is no max-height constraint or scrollable container on the hint/improve panels.
- **Evidence:** The message bubble `max-w-[82%]` is appropriate, but there is no `word-break: break-word` equivalent applied. Long unbroken URLs or words in non-Latin scripts could overflow on narrow screens.
- **Evidence:** The header turn progress bar (`mt-2.5`) and the bottom input zone consume ~140px combined on a 667px screen, leaving only ~527px for messages. With hint/improve panels open this collapses further.
- **Evidence:** Font sizes go as low as `text-[9px]` (selectedLabel in scenario card). This is below Apple's and Android's recommended minimum of 11–12px and is inaccessible on standard mobile DPI.
- **Evidence:** `VoiceSettingsPanel` is a bottom sheet with no swipe-to-dismiss gesture handler — only a tap-outside and an ✕ button. On iOS this is non-standard UX.

---

## 3. AI CONVERSATION QUALITY
**Verdict: PASS** *(with conditions)*

- **Evidence:** The system prompt enforces 1–2 sentences, lists 13 forbidden opener words, implements 8-turn anti-repetition banning with verbatim listing, bans structural bridge phrases, provides CEFR-level granular instructions, and includes persona names per scenario. This is production-grade prompt engineering.
- **Evidence:** The `stripBridgeSentence()` post-processor applies a deterministic regex filter on top of the prompt, catching model drift even when instructions are ignored.
- **Evidence:** `temperature: 0.85`, `frequency_penalty: 0.8`, `presence_penalty: 0.6` — these are correctly tuned to reduce repetition while maintaining creativity.
- **Evidence:** The `errorTrackBlock` feeds the last 4 learner messages into the prompt for silent in-session error tracking and implicit correction. This is pedagogically sound.
- **Condition:** `max_completion_tokens: 160` is tight. The examples given in the prompt (e.g. "Redis loses messages on restart without AOF persistence — did you run replication...") are 25+ words each. A 2-sentence complex professional response at this token limit will regularly be truncated on the model side, producing broken outputs. No truncation detection exists in the response handler — it only checks for empty string.

---

## 4. SCENARIO REALISM
**Verdict: PASS**

- **Evidence:** 6 of 30 scenarios have deep character briefs (`PROFESSIONAL_ROLE_INSTRUCTIONS`): job_interview (James), luxury_boutique (Isabelle), networking (David), journalist_interview (Rachel), trade_fair (Thomas), executive_assistant (Claire), medical_secretary (Margaret). Each includes vocabulary lists, behavioural constraints, and forbidden actions.
- **Evidence:** The remaining 24 scenarios receive only a one-line `SCENARIO_LABELS` description. No character brief. The `PROFESSIONAL_SCENARIOS` set partially compensates with a register note, but "professional register" without a character brief produces generic AI behaviour.
- **Evidence:** The `NEXT_CHALLENGE` map in `FeedbackView.tsx` provides scenario progression logic — pedagogically appropriate. Descriptions are in English only and are not translated (hardcoded English strings, not i18n keys).
- **Evidence:** Dating, cooking, entertainment, and daily_life scenarios have no character brief, no persona name, and only a 1-line label. These will produce inconsistent, flat AI responses compared to professional scenarios.

---

## 5. LEARNING PSYCHOLOGY
**Verdict: WARNING**

- **Evidence:** The session is capped at `MAX_TURNS = 15` with no notification until `turnsLeft <= 3`. Users who are mid-flow at turn 13 receive a sudden "2 turns left" warning with no explanation of what happens at turn 15. There is no grace extension, no mid-session summary, no option to save progress.
- **Evidence:** The `updateAfterSession()` in `learnerMemory.ts` stores CEFR level, scenario history, and error tags. However, `HomeView.tsx` renders the returning-user block only if `profile.totalSessions > 0`, and it hard-codes English strings ("session" / "sessions") inside the JSX — these are not translated.
- **Evidence:** The `buildMemoryNote()` function passes learner history to subsequent sessions. But the `learnerContextRef` is initialized once at component mount (`useRef<string>(buildMemoryNote(getLearnerProfile()))`). If the profile is updated mid-session (e.g. the user runs a second session in the same component mount without a full page reload), the context stale. In practice this is unlikely but is a correctness issue.
- **Evidence:** Positive reinforcement is entirely AI-generated via the feedback endpoint. The app itself provides no moment-to-moment encouragement between turns — no micro-feedback, no progress signal other than the turn counter. The `practice` mode coach is supposed to be "warm and encouraging" but the response format is 1–2 sharp sentences. These goals conflict.
- **Evidence:** There is no onboarding sequence. A first-time user on a non-English interface (e.g. Arabic, Japanese) hits the home screen with no tutorial, no example session, no explanation of how voice mode works. The only guidance is `tapToSpeak →` inside the conversation screen — visible only after clicking through setup.

---

## 6. VOICE SYSTEM
**Verdict: WARNING**

- **Evidence:** `speak()` in `tts.ts` fires with a 50ms `setTimeout` to allow voice list loading. On iOS Safari, the voice list loads asynchronously and may not be ready at 50ms on first load. The fallback listens on `voiceschanged` once — correct. However, the `warmUpTts()` silent utterance may be cancelled by the subsequent 50ms timeout check: `if (!_currentUtterance) window.speechSynthesis.cancel()`. If `_currentUtterance` was set by the warm-up, this guard works. If the warm-up utterance completed before 100ms (common), `_currentUtterance` is null by then and `cancel()` fires unnecessarily — this can interrupt a real utterance on fast devices.
- **Evidence:** `utterance.lang = "en-US"` is set before voice selection but may be overridden by `utterance.lang = best.lang` inside `doSpeak()`. This is correct. However if `best` is null (no suitable voice), the utterance proceeds with `en-US` and whatever default voice the browser assigns — potentially not English on some Android devices.
- **Evidence:** The keep-alive timer fires every 10 seconds to `pause()`/`resume()` the synthesizer — this is a known Chrome Android workaround for the >15s silence bug. Correct implementation.
- **Evidence:** `getVoiceAvailability()` returns `"limited"` when voices exist but the best score is < 50. The conversation screen shows a `voiceUnavailableMsg` only when availability === `"unavailable"`. Users with `"limited"` voice quality receive no warning — they get degraded TTS with no explanation.
- **Evidence:** Voice settings (accent, speed) are not exposed in the conversation header — users must open the settings gear to change them mid-session. Discovery of this panel is low; there is no onboarding tooltip pointing to it.

---

## 7. MIC RELIABILITY
**Verdict: WARNING**

- **Evidence:** `useSpeechRecognition` sets `recognition.continuous = false`. This means recognition stops after the first detected utterance end. The user must tap the mic button for every single message. This is intentional but is never explained to the user — no UI element says "tap mic, speak, mic stops automatically."
- **Evidence:** `recognition.lang = lang` is hardcoded to `"en-US"` in the `ConversationView` call — `useSpeechRecognition(handleSpeechResult, "en-US")`. Non-English native speakers practicing English are correctly served with `en-US` recognition. However the `lang` parameter is fixed — there is no UI to change speech recognition language. A Russian learner speaking English will use `en-US` STT, which is correct, but this is not surfaced to users as a feature or explained.
- **Evidence:** On `onerror` with `event.error === "aborted"`, the error is set to `null`. This means if the mic is aborted mid-speech (e.g. user taps away), the UI silently returns to idle with no message. Correct behaviour, but `micState` is set to "idle" only inside the `speechError` useEffect — and that only fires if `speechError !== null`. An `"aborted"` error sets `speechError` to null, so the useEffect fires but `setMicState("idle")` is NOT called by the error handler. The mic state is reset inside `stopListening()` which is called by `handleMicPress`. If the user never re-taps the mic but the recognition aborts silently, `micState` can stay on `"listening"` indefinitely.
- **Evidence:** No silence timeout exists. If a user taps the mic but says nothing, the browser's built-in `no-speech` timeout fires after ~8 seconds, which correctly shows the `noSpeech` error. However, if the user pauses mid-sentence, recognition may fire `onend` with a partial transcript — `finalTranscriptRef.current` will hold whatever was captured, and it will be submitted. The user has no way to cancel without tapping stop.

---

## 8. TRANSLATION
**Verdict: PASS**

- **Evidence:** Translation is triggered per-message, on demand, with toggle visibility (show/hide). The UI correctly gates translation button display on `feedbackLanguage !== "English"` — preventing unnecessary API calls for English-only users.
- **Evidence:** Translation results are cached in `msgTranslations` state by message index. Re-tapping "Translate" toggles visibility without re-calling the API. Correct.
- **Evidence:** The translate endpoint accepts up to 2000 chars, returns the original text if `targetLanguage === "English"` (no API call). Correct short-circuit.
- **Evidence:** The `VoiceSettingsPanel` "Voice Settings" header is hardcoded English — not translated. Same for rate labels ("Very slow", "Slow", "Normal", etc.) and all accent option labels. These are visible to non-English interface users.
- **Evidence:** `NEXT_CHALLENGE[scenario].desc` strings in `FeedbackView.tsx` are all hardcoded English — not i18n keys. French, Arabic, Japanese users see English-only scenario recommendations after their session.

---

## 9. END-SESSION COACHING
**Verdict: PASS** *(with conditions)*

- **Evidence:** The feedback prompt is detailed and structured: CEFR level, 2 strengths referencing specific transcript moments, up to 3 corrections in strict format, corrected example, fluency observation, concrete next step, strongest phrase. This is substantively better than generic feedback.
- **Evidence:** The `tip` field is set to `""` in the prompt instructions and the server returns it as empty string. The `FeedbackView.tsx` conditionally renders all cards — `tip` is in `FeedbackData` interface but never rendered in the UI. Dead field.
- **Evidence:** `feedback.correctedExample` must be in English per prompt rules, while all other fields must be in `feedbackLanguage`. This is correct and intentional. However, the `correctedExample` card label is translated ("Natural Upgrade") but the content below it is always English. For Arabic/Chinese/Japanese users, the card appears to break language consistency. No explanatory note is shown.
- **Evidence:** `strengths` is capped at `slice(0, 2)` and `improvements` at `slice(0, 3)` in the server response handler. If the model returns fewer (e.g. a 2-turn session may produce only 1 strength), the UI renders gracefully due to `.length > 0` guards.
- **Condition:** The feedback endpoint receives messages but has no minimum message count check. A user who sends 1 message and ends the session immediately triggers a full feedback generation on a transcript of 1 turn. The AI will hallucinate feedback with minimal real data. `ConversationView` gates `handleEndSession` with `messages.length < 2` (redirect to setup instead), which prevents this edge case. Correct.

---

## 10. TRUST / CONVERSION
**Verdict: WARNING**

- **Evidence:** "Premium plans coming later" is displayed on both HomeView and SessionSetupView. Anchoring future cost before free value is delivered increases bounce rate.
- **Evidence:** "No account required · Sessions are anonymous" (privacyNote) is good — but positioned at the bottom in `text-white/22` (22% opacity). Functionally invisible. This is the #1 trust signal for privacy-conscious users and it is rendered nearly invisible.
- **Evidence:** "Created by Antony Addy · Professional English trainer" appears on both HomeView (creator card) and FeedbackView footer. There is no link, no credential, no photo, no social proof — just a name and title. This is an assertion, not evidence.
- **Evidence:** The free launch badge uses `animate-pulse` on the dot — a strong visual cue. But "Free during launch" implies scarcity (it will end) without a date or timeframe. This creates vague anxiety rather than urgency.
- **Evidence:** There is no error boundary in `App.tsx`. If `ConversationView` throws an unhandled runtime error, the entire app goes white. No fallback UI, no recovery path, no user-visible error message.
- **Evidence:** The AuditDashboard is behind `Ctrl+Shift+Q` in development. Its existence in the production bundle is controlled only by `import.meta.env.DEV || VITE_TRAINER_AUDIT_MODE`. If `VITE_TRAINER_AUDIT_MODE` is accidentally set to `"true"` in production, internal audit tooling becomes accessible to any user.

---

## A. LAUNCH SCORE

| Dimension | Score |
|-----------|-------|
| First impression | 62/100 |
| Mobile experience | 58/100 |
| AI conversation quality | 80/100 |
| Scenario realism | 70/100 |
| Learning psychology | 55/100 |
| Voice system | 65/100 |
| Mic reliability | 62/100 |
| Translation | 72/100 |
| End-session coaching | 78/100 |
| Trust / conversion | 55/100 |

**Overall launch score: 66/100**

---

## B. TOP 10 WEAKNESSES

1. **Mic state stuck on "listening" after silent abort** — `micState` is never reset to "idle" when recognition fires `onerror` with `"aborted"`. The error effect runs but does not call `setMicState`. UI shows "Listening..." with no recovery path short of a page reload.

2. **Hint and improve panels have no max-height on small screens** — On 375×667 (iPhone SE), long hint content + message history + input bar will push the input off-screen. No scroll container, no height cap.

3. **No minimum viable session before feedback is meaningful** — The feedback prompt requires enough turns to find strengths, but there is no UI guidance telling users how many turns constitute a useful session. Users can have 2-turn sessions and receive AI-hallucinated feedback.

4. **`max_completion_tokens: 160` will regularly truncate professional scenario responses** — Example prompts in the system prompt exceed 25 words per sentence. A 2-sentence professional response can be cut mid-thought, producing malformed or trailing output. No truncation detection exists.

5. **`NEXT_CHALLENGE.desc` strings are untranslated English in FeedbackView** — All 30 scenario progression descriptions are hardcoded English. A French, Russian, or Arabic user finishing a session receives English-only coaching suggestions.

6. **`"limited"` voice availability shows no user warning** — `getVoiceAvailability()` returns `"limited"` when voice quality is degraded, but ConversationView only reacts to `"unavailable"`. Users with robotic/low-quality TTS receive no explanation.

7. **No error boundary in App.tsx** — A runtime error in any view (ConversationView, FeedbackView) produces a white screen with no recovery. No fallback UI exists.

8. **Privacy note is 22% opacity — functionally invisible** — `text-white/22` renders the #1 conversion-critical trust statement ("No account required · Sessions are anonymous") at near-zero contrast.

9. **`VoiceSettingsPanel` labels are not translated** — "Voice Settings", "Auto-speak", "Accent", "Speaking Speed", "Very slow", "Slow", "Normal", "Fast", "Very fast" are all hardcoded English regardless of interface language.

10. **`AuditDashboard` is conditionally bundled but accessible via env var in production** — If `VITE_TRAINER_AUDIT_MODE=true` is set in a production build, internal tooling becomes user-accessible. No production guard exists.

---

## C. TOP 10 IMPROVEMENTS

1. **Add `setMicState("idle")` to the `"aborted"` error branch in `useSpeechRecognition`**, or handle it inside `ConversationView`'s speech error effect unconditionally for all non-null and null-abort cases.

2. **Add `max-h-48 overflow-y-auto` to hint and improve panels** so they scroll internally instead of displacing the input bar on small screens.

3. **Raise `max_completion_tokens` to 220 for the conversation endpoint** and add a basic truncation check: if the response does not end with a sentence-terminating punctuation mark (`.`, `?`, `!`), log it and optionally retry or append `"..."`.

4. **Move `NEXT_CHALLENGE.desc` strings to i18n keys** or, as a faster fix, generate them in the feedback prompt for the user's `feedbackLanguage`.

5. **Show a `"limited"` voice warning** in the input area footer — the same location as `"unavailable"`, just with a softer message: "Voice quality may be limited on this device."

6. **Add an error boundary component** wrapping `<ViewRouter />` in `App.tsx` that catches render errors and shows a recovery screen with a "Restart session" button instead of a white screen.

7. **Change `text-white/22` to `text-white/45`** on the privacy note in `HomeView.tsx`. This is a single Tailwind class change that makes the #1 trust signal legible.

8. **Translate `VoiceSettingsPanel` labels** using the `interfaceLanguage` from context, or pass `t()` into the panel as a prop.

9. **Remove or conditionally gate `AuditDashboard` from the production bundle** using `if (import.meta.env.DEV)` tree-shaking — not a runtime flag that can be set externally.

10. **Replace "Premium plans coming later" with nothing** on HomeView, and move it exclusively to a post-session or settings location. Remove it from the first-impression surface entirely.

---

## D. WHAT MUST BE FIXED TONIGHT

These are blocking issues — shipping with any of them creates user-visible failures or security risk:

| # | Fix | Severity | File | Change |
|---|-----|----------|------|--------|
| 1 | **Mic stuck in "listening" state after silent abort** | Critical | `useSpeechRecognition.ts` or `ConversationView.tsx` | Call `setMicState("idle")` / `isProcessingRef.current = false` on `"aborted"` error path |
| 2 | **Hint/improve panels overflow on small screens** | High | `ConversationView.tsx` | Add `max-h-48 overflow-y-auto` to both panel wrappers |
| 3 | **Privacy note invisible at 22% opacity** | High | `HomeView.tsx` | Change `text-white/22` → `text-white/45` |
| 4 | **No error boundary — white screen on any render error** | High | `App.tsx` | Wrap `<ViewRouter />` with a minimal React error boundary |
| 5 | **AuditDashboard accessible via env var in production** | Medium | `App.tsx` | Gate on `import.meta.env.DEV` only, remove `VITE_TRAINER_AUDIT_MODE` check |

---

## E. FINAL VERDICT

```
PRIVATE TESTING ONLY
```

**Rationale:**

The AI conversation quality and the feedback system are production-grade. The core loop — setup → conversation → feedback — is functional end-to-end. The i18n coverage across 12 languages is complete for primary keys.

However, the mic state bug (Weakness #1) means users can be stuck in a broken listening state with no recovery except a page reload — this is a user-facing failure on any session where the browser aborts recognition silently. The absence of an error boundary means any JavaScript error in ConversationView produces a white screen with no exit. The hint/improve overflow is a consistent failure on any sub-375px device.

These are not polish issues — they are functional blockers. The app should be tested with a small group of real users (not developers) on real mobile devices across iOS Safari and Chrome Android before public launch. Once the five D-list items are resolved and tested on device, the score rises to approximately **76/100**, which is an acceptable threshold for a free public beta.

---

*Audit complete. No compliments given. All findings are evidence-based from the production codebase.*
