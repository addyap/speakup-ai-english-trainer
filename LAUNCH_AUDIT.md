# SpeakUp AI — Internal Launch Audit
**Date:** 2026-05-03  
**Auditors:** PM · UX · Mobile QA · AI Conversation Designer · Conversion Strategist  
**Source:** Full codebase read — HomeView, SessionSetupView, LanguageSelectionView, ConversationView (all 1020 lines), FeedbackView, trainer.ts (all 664 lines), useSpeechRecognition, tts.ts, AppContext, learnerMemory, translations.ts

---

## Dimension 1 — First Impression
**VERDICT: WARNING**

Evidence:
- `HomeView.tsx` contains zero calls to `t()`. Every string — headline "Professional AI English Coaching", subtitle, CTA "Start Training Free", "No card required today", "Premium plans coming later", "Created by Antony Addy · Professional English Trainer" — is hardcoded English. A French or Arabic user who has already set their language in a previous session will land on a fully English home screen.
- The creator card ("Antony Addy / Professional English Trainer") provides no credentials, no external link, no photo. It is the app's only trust signal and it asserts authority without evidence.
- There is no sample conversation, no preview of how the AI actually speaks, and no explanation of the learning loop. Users must commit to starting a session before they understand what the product does.
- "Premium plans coming later" signals that the free period is temporary without specifying when it ends. This deters commitment from users who want to know if the app will remain accessible.

---

## Dimension 2 — Mobile Experience
**VERDICT: WARNING**

Evidence:
- Voice settings button: `w-8 h-8` = 32×32px. Below the 44px minimum touch target on iOS and 48dp on Android.
- "End Session" button: `px-3 py-1.5 text-xs` — approximately 30–32px tall. Below minimum.
- `SessionSetupView` header: `pt-safe pt-12` — these two classes are stacked. If `pt-safe` does not resolve to a real CSS variable (requires explicit Tailwind plugin config), the safe area padding is absent and content clips under the notch.
- The entire `SessionSetupView` is hardcoded English: section headers "Your language", "Coach persona", "Choose a scenario", "Proficiency level", coach labels and descriptions, level labels and descriptions, CTA "Start Speaking", footer note "Settings can be changed between sessions". None use `t()`.
- Featured scenario label: `{ value: "executive_assistant", label: "Asst. de Direction" }` — this is French text hardcoded into the English setup screen. It is not a translation; it is an error.
- `interimTranscript` is returned by `useSpeechRecognition` but never rendered anywhere in `ConversationView`. The user sees a static listening indicator with no real-time feedback that the mic is picking up their voice.
- Hardcoded English strings in ConversationView: "Auto-speak off — tap 🔊 under any reply to hear it.", "Settings", "Tap mic to interrupt", "Speak", "Replay", "Stop", "More natural", "Corrected", "Vocab:".

---

## Dimension 3 — AI Conversation Quality
**VERDICT: PASS**

Evidence:
- System prompt enforces 1–2 sentence replies, banned openers, one question per turn, no metalanguage.
- Anti-repetition: last 8 AI replies are listed verbatim in the `bannedBlock` — the model cannot echo or rephrase any of them.
- Bridge sentence stripping: `BRIDGE_SENTENCE_RE` regex post-processes every response deterministically, removing the "In this role, we expect…" class of AI boilerplate that prompting alone cannot fully suppress.
- CEFR calibration: four distinct level prompts (auto, beginner, intermediate, advanced) with concrete vocabulary and grammar constraints per level.
- Error tracking: last 4 learner messages scanned for recurring patterns; correct form woven into AI reply implicitly.
- Professional role instructions provided for 7 scenarios (job_interview, luxury_boutique, networking, journalist_interview, trade_fair, executive_assistant, medical_secretary) with named characters, specific vocabulary lists, and behaviour constraints.
- Weakness: 23 of 30 scenarios have no persona brief — they receive only the generic character line. Scenarios like `emergency`, `dating`, `legal`, `banking`, `medical`, `real_estate`, and `hotel` have named personas but no character brief in `PROFESSIONAL_ROLE_INSTRUCTIONS`, leaving the AI to improvise the character entirely.
- `recognition.lang` is hardcoded `"en-US"` in `useSpeechRecognition.ts` regardless of the user's selected accent preference. British or Australian accent preference has no effect on recognition accuracy.

---

## Dimension 4 — Scenario Realism
**VERDICT: WARNING**

Evidence:
- 30 scenarios exist with named AI personas for all of them (PERSONA_NAMES covers all 30).
- Only 7 scenarios have a full character brief in `PROFESSIONAL_ROLE_INSTRUCTIONS`. The remaining 23 receive the generic system prompt with a one-line scenario description from `SCENARIO_LABELS`. This means a medical visit, legal consultation, banking scenario, or emergency call starts with only "a medical visit — describing symptoms, understanding a diagnosis, asking the pharmacist" as the AI's character context.
- `SessionSetupView` featured card: `label: "Asst. de Direction"` — French in an English UI component. This is a copy error, not a translation.
- All scenario descriptions in the featured and full scenario grids are hardcoded English. If a user reads the setup screen in their native language they set elsewhere, the scenario descriptions are still in English.
- `NEXT_CHALLENGE` in `FeedbackView` contains 30 hardcoded English description strings ("Pitch your ideas and hold your own in a corporate discussion."). None are translated.

---

## Dimension 5 — Learning Psychology
**VERDICT: WARNING**

Evidence:
- There is no onboarding assessment. Every new user starts at level "auto" (calibrated to B1) on scenario "small_talk" regardless of actual level. A C1 user and an A1 user begin identically.
- The hint feature (`Help me answer`) puts the selected hint directly into the text input via `setTextInput(text)`. The user can press 💡, select a suggestion, and send it without composing any English themselves. There is no friction, no encouragement to write first. The feature is a crutch with no guardrail.
- `learnerMemory` stores error tags but extraction is shallow: `imp.match(/instead of ['"]([^'"]{1,40})['"]/i)` extracts the literal error phrase, not the grammatical pattern. "have been" and "I have went" both produce short string tags with no categorization. The AI's `learnerContext` injection in the hint route will receive a list of these literal strings, not pattern labels.
- There is no UI anywhere showing cross-session progress: "You've completed 7 sessions", "Your level estimate has moved from B1 to B2". `totalSessions` and `estimatedLevel` are stored in localStorage but never displayed to the user.
- `CEFR_EXPLANATIONS` ("Basic greetings and simple phrases" etc.) in `FeedbackView` are hardcoded English, displayed to all users regardless of interface language.
- `MAX_TURNS = 15` is a fixed ceiling with no per-level calibration. A beginner attempting 15 turns is exhausting; an advanced user may feel artificially cut off.

---

## Dimension 6 — Voice System
**VERDICT: WARNING**

Evidence:
- The entire TTS implementation uses Web Speech API only. Quality is device-dependent: robot-quality on Windows Edge, good on iOS Safari, variable on Chrome Android.
- `getVoiceAvailability()` is defined and exported in `tts.ts` but is never called in `ConversationView.tsx`. If no English voices are available, the user receives no warning — the speak/replay buttons render and appear to work but produce nothing.
- `recognition.lang = "en-US"` in `useSpeechRecognition.ts` is hardcoded. The British/American accent preference in `VoiceSettingsPanel` affects TTS output voice selection but has zero effect on speech recognition language.
- The `VoiceProvider` interface for premium voice (ElevenLabs/OpenAI TTS) is stubbed in `tts.ts` but not implemented. The `registerPremiumVoiceProvider` and `getPremiumProvider` functions exist and are exported but nothing calls them.
- The 30-second TTS safety timeout (`speakTimerRef = setTimeout(onSpeechEnd, 30_000)`) silently resets micState to idle if TTS fails to fire `onend`. The user sees no notification that the AI speech failed.

---

## Dimension 7 — Mic Reliability
**VERDICT: WARNING**

Evidence:
- `interimTranscript` is captured in `useSpeechRecognition` and returned as part of the hook interface, but is not rendered anywhere in `ConversationView`. The user sees only the pulsing listening indicator — no text showing what the mic is hearing.
- `continuous: false` means recognition stops after each utterance. The user must tap the mic for every single response. There is no hold-to-speak, no push-to-talk, no voice activity detection.
- `error === "aborted"` is mapped to `setError(null)` — if recognition aborts for an unexpected reason (not triggered by the user), the error is silently suppressed and the mic state may not recover cleanly.
- Recognition language hardcoded to `"en-US"` means speakers with non-US accents (the majority of the target 12-language audience) receive no accent-adapted recognition. A Japanese learner speaking English with their native accent may experience higher rejection rates.
- No retry logic on `no_speech`. The user must dismiss the error and tap the mic again manually.

---

## Dimension 8 — Translation
**VERDICT: FAIL**

Evidence:
- `HomeView.tsx`: 0 calls to `t()`. The entire entry screen is hardcoded English for all 12 language users.
- `SessionSetupView.tsx`: 0 calls to `t()` for any UI label. Section headers, coach descriptions, level descriptions, scenario descriptions, CTA, footer note — all hardcoded English.
- `LanguageSelectionView.tsx`: uses `t()` — this screen is translated.
- `ConversationView.tsx` untranslated strings (evidence from source): "Auto-speak off — tap 🔊 under any reply to hear it." (line 931), "Settings" (line 934), "Tap mic to interrupt" (line 969), "Speak" (line 720), "Replay" (line 720), "Stop" (line 706), "More natural" (hint panel, line 861), "Corrected" (improve panel, line 905), "More natural" (improve panel, line 912), "Vocab: " (line 868).
- `FeedbackView.tsx` untranslated strings: "🔥 Tomorrow's Challenge" (line 299), "Try this next →" (line 314), all 30 `NEXT_CHALLENGE.desc` strings (lines 35–65), all 6 `CEFR_EXPLANATIONS` strings (lines 93–98), `"{t(interfaceLanguage, "back")} to Home"` where "to Home" is hardcoded English (line 340).
- `SessionSetupView.tsx`: `label: "Asst. de Direction"` — French hardcoded into English UI (line 14).

Summary: The app markets itself as supporting 12 languages. The onboarding (HomeView + SessionSetupView) is 0% translated for non-English users. This is a fundamental gap.

---

## Dimension 9 — End-Session Coaching
**VERDICT: PASS**

Evidence:
- 7 structured feedback dimensions: CEFR level, Strengths ×2, Strongest Phrase, Priority Corrections ×3, Natural Upgrade, Fluency Observation, Next Step.
- `correctedExample` is always rendered in English by prompt design ("MUST be in English") — this is correct for language learning but the card label is translated while the content is English. This is intentional and acceptable.
- `strongestPhrase` surfaces the learner's best utterance — strong motivational signal.
- `fluencyComment` is specifically instructed to observe "pace, filler words, hesitation patterns, self-correction" and explicitly NOT grammar — this separation is pedagogically sound.
- `nextStep` prompt rule: "NOT 'practice more.' Name a technique or exercise. Max 25 words." — good specificity guard.
- Weaknesses: `CEFR_EXPLANATIONS` are hardcoded English. "Tomorrow's Challenge" fully hardcoded English. No comparison to previous sessions ("Last time you were B1, now B2"). No share/export of results. No email capture for return pathway — all session data is localStorage-only.

---

## Dimension 10 — Trust / Conversion
**VERDICT: FAIL**

Evidence:
- The only trust signal on `HomeView` is "Created by Antony Addy · Professional English Trainer" in a small card with a generic icon. No credentials, no link, no photo.
- No testimonials, no user count, no "X sessions completed" social proof.
- No sample conversation or demo — the user must begin a session to understand what the product does.
- No privacy policy link anywhere in the app. The backend stores `device_id`, `estimated_level`, `error_tags`, `scenario`, `interface_language`, `feedback_language` in PostgreSQL (`speakup_sessions` table). This is anonymous but undisclosed to the user.
- No email capture at any point. When premium launches, there is no mechanism to notify existing users. When a user returns after a browser clear, their learner profile (localStorage) is gone.
- "Premium plans coming later" — the timing is unspecified. This signals that free access is temporary without a commitment date, which discourages users from investing time in the product.
- `deviceId` is generated per-browser with `Math.random()` — users on two devices have separate profiles with no cross-device sync path.

---

## A — Launch Score

**52 / 100**

| Dimension | Score |
|-----------|-------|
| First impression | 6/10 |
| Mobile experience | 6/10 |
| AI conversation quality | 9/10 |
| Scenario realism | 6/10 |
| Learning psychology | 5/10 |
| Voice system | 6/10 |
| Mic reliability | 5/10 |
| Translation | 4/10 |
| End-session coaching | 8/10 |
| Trust / conversion | 3/10 |

---

## B — Top 10 Weaknesses

1. **HomeView is 0% translated.** A 12-language product whose landing screen is hardcoded English for every non-English user.
2. **SessionSetupView is 0% translated.** The entire onboarding and session configuration screen uses no `t()` calls. Non-English users configure their session in English.
3. **"Asst. de Direction" is French hardcoded in an English UI component.** A copy error in `SessionSetupView.tsx` line 14.
4. **interimTranscript is never rendered.** The hook returns it, ConversationView ignores it. Users have no real-time visual confirmation the mic is hearing them.
5. **No trust signals beyond a creator name card.** No credentials, no testimonials, no user count, no demo conversation, no privacy statement.
6. **Voice unavailability is not surfaced.** `getVoiceAvailability()` is implemented but never called in ConversationView. If a user's browser has no English TTS voices, the speak/replay buttons appear functional but produce nothing.
7. **Hint feature enables passive use.** Users can complete entire sessions by pressing 💡 and sending suggestions verbatim without composing any English.
8. **Recognition language hardcoded en-US.** Accent preference setting affects TTS only. The 12-language learner audience — most of whom are non-US — receives no accent-adapted speech recognition.
9. **CEFR explanations, Tomorrow's Challenge, and all next-challenge descriptions are hardcoded English.** The feedback screen's most important narrative sections are untranslated.
10. **No cross-session progress display.** `totalSessions` and `estimatedLevel` are persisted in localStorage but never shown to the user. There is no motivational signal for returning users.

---

## C — Top 10 Improvements

1. **Translate HomeView.** Replace all hardcoded strings with `t(interfaceLanguage, key)` calls. Add the required keys to all 12 language blocks. The home screen must respect the user's saved language on return.
2. **Translate SessionSetupView.** All section labels, coach/level/scenario descriptions, the CTA, and footer note must go through `t()`. This is the most-used screen in the product.
3. **Fix "Asst. de Direction" to "Executive Assistant" or add a translation key.** The featured card must use the correct English label or the translated label via `t()`.
4. **Display interimTranscript in ConversationView.** Show the partial transcript as the user speaks. Even a single line of dimmed text below the mic button eliminates the uncertainty of "is it hearing me?"
5. **Call `getVoiceAvailability()` on mount and show a banner if unavailable.** Users on browsers with no TTS voices should be told voice playback is not available on their device and offered the translate button as an alternative.
6. **Add a privacy note and data statement.** One line on HomeView: "No account required. Sessions are anonymous." Plus a privacy policy link. The backend collects data; the frontend must disclose it.
7. **Translate the FeedbackView untranslated strings.** "Tomorrow's Challenge", "Try this next →", all `NEXT_CHALLENGE.desc` strings, `CEFR_EXPLANATIONS`, and the "to Home" string fragment must be added to the translation system.
8. **Translate the ConversationView hardcoded strings.** "Speak", "Replay", "Stop", "More natural", "Corrected", "Vocab:", "Auto-speak off…", "Tap mic to interrupt" — all need translation keys.
9. **Add at least one social proof element to HomeView.** A static session count ("10,000+ practice sessions"), a sample quote, or a short video clip of the AI conversation in action. The current page asks users to trust an invisible product.
10. **Show returning users their progress.** On HomeView or SessionSetupView, display "Session 4 · Last level: B1" from `learnerMemory`. This is the single highest-leverage retention feature given the data is already being stored.

---

## D — Must Fix Tonight

These four issues block a credible launch for a multilingual product:

### 1. Translate HomeView and SessionSetupView
**Why tonight:** Every non-English user who opens the app sees 100% English on the two screens they spend the most time on. This is not a missing feature — it contradicts the product's core promise of 12-language support.

**Scope:** Add translation keys for all hardcoded strings in both files. All 12 language blocks already exist in `translations.ts`; the keys just need adding and the components need to call `t()`.

### 2. Fix the French label "Asst. de Direction"
**Why tonight:** A French string in an English UI component looks like a bug to every English-speaking user and is confusing to every French-speaking user (who sees it on an otherwise English screen). One line change.

### 3. Add a privacy/data disclosure line
**Why tonight:** The backend stores device IDs and session data. Launching without any disclosure is a legal and trust risk. One sentence on HomeView is sufficient for launch.

### 4. Surface voice unavailability
**Why tonight:** Users on Android devices with no installed TTS voices will tap 🔊 buttons and hear nothing with no explanation. This is a broken experience that reads as a product bug, not a device limitation.

---

## E — Final Verdict

**PRIVATE TESTING ONLY**

The AI engine, conversation architecture, feedback system, and voice implementation are technically strong. The product cannot launch publicly in its current state because its core multilingual promise is broken at the entry point: HomeView and SessionSetupView are 100% English for all 12 languages. A French user who sets their language, goes back to home, and returns is greeted in English. A Chinese user configuring their first session reads every label in English. The translation infrastructure exists and works in the conversation and language selection screens — the gap is in the two highest-traffic screens. Fix those four items above and re-audit before opening to the public.
