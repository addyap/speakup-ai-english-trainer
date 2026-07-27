import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, type Message, type Scenario } from "@/lib/AppContext";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useVoiceSettings } from "@/hooks/useVoiceSettings";
import { speak, stopSpeech, warmUpTts, unlockTtsOnGesture, getVoiceAvailability, autoSelectVoiceURI, type VoiceAvailability } from "@/lib/tts";
import { VoiceSettingsPanel } from "@/components/VoiceSettingsPanel";
import {
  useSendConversationMessage,
  useTranslateMessage,
  useImproveMessage,
} from "@workspace/api-client-react";
import type { HintResponse, ImproveResponse } from "@workspace/api-client-react";
import { t } from "@/i18n/translations";
import { getLearnerProfile, buildMemoryNote, updateAfterSession } from "@/lib/learnerMemory";

const MAX_TURNS = 15;

type TranslationKey = Parameters<typeof t>[1];

type TranslationEntry = {
  text: string;
  loading: boolean;
  error: boolean;
  visible: boolean;
};

const SCENARIO_EMOJIS: Record<Scenario, string> = {
  job_interview: "💼", small_talk: "☕", business_meeting: "📊",
  travel: "✈️", daily_life: "🏙️", restaurant: "🍽️",
  shopping: "🛍️", medical: "🏥", academic: "🎓",
  phone_call: "📞", airport: "🛫", hotel: "🏨",
  banking: "🏦", apartment: "🏠", dating: "💬",
  sports: "🏋️", news_debate: "📰", customer_service: "🎯",
  tech_support: "💻", real_estate: "🏡", legal: "⚖️",
  emergency: "🚨", cooking: "👨‍🍳", entertainment: "🎬",
  networking: "🤝", luxury_boutique: "💎", trade_fair: "🏛️",
  executive_assistant: "🗂️", medical_secretary: "🩺", journalist_interview: "🎙️",
};

const SCENARIO_LABEL_KEYS: Record<Scenario, TranslationKey> = {
  job_interview: "jobInterview", small_talk: "smallTalk", business_meeting: "businessMeeting",
  travel: "travel", daily_life: "dailyLife", restaurant: "restaurant",
  shopping: "shopping", medical: "medical", academic: "academic",
  phone_call: "phoneCall", airport: "airport", hotel: "hotel",
  banking: "banking", apartment: "apartment", dating: "dating",
  sports: "sports", news_debate: "newsDebate", customer_service: "customerService",
  tech_support: "techSupport", real_estate: "realEstate", legal: "legal",
  emergency: "emergency", cooking: "cooking", entertainment: "entertainment",
  networking: "networking", luxury_boutique: "luxuryBoutique", trade_fair: "tradeFair",
  executive_assistant: "executiveAssistant", medical_secretary: "medicalSecretary",
  journalist_interview: "journalistInterview",
};

const LEVEL_CEFR: Record<string, string> = {
  auto: "Auto", beginner: "A1–A2", intermediate: "B1–B2", advanced: "C1–C2",
};

// ─── Streaming feedback fetch ─────────────────────────────────────────────────
type FeedbackStreamPayload = {
  messages: Message[];
  mode: string;
  feedbackLanguage: string;
  interfaceLanguage: string;
  deviceId: string;
  scenario: string;
};
type FeedbackStreamResult = {
  estimatedLevel: string; strengths: string[]; improvements: string[];
  correctedExample: string; fluencyComment: string; nextStep: string;
  strongestPhrase: string; tip: string;
};

async function fetchFeedbackStream(payload: FeedbackStreamPayload): Promise<FeedbackStreamResult> {
  const res = await fetch("/api/trainer/feedback-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) throw new Error(`Feedback stream HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) throw new Error("Stream ended without feedback");
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const evt = JSON.parse(line.slice(6)) as { t?: string; done?: boolean; feedback?: FeedbackStreamResult; error?: string };
      if (evt.error) throw new Error(evt.error);
      if (evt.done && evt.feedback) return evt.feedback;
    }
  }
}

// ─── Streaming hint fetch ─────────────────────────────────────────────────────
type HintStreamPayload = {
  messages: Message[];
  scenario: string;
  level: string;
  feedbackLanguage: string;
  interfaceLanguage: string;
  learnerContext?: string;
};

async function fetchHintStream(payload: HintStreamPayload): Promise<HintResponse> {
  const res = await fetch("/api/trainer/hint-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) throw new Error(`Hint stream HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) throw new Error("Stream ended without hint");
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const evt = JSON.parse(line.slice(6)) as { t?: string; done?: boolean; hint?: HintResponse; error?: string };
      if (evt.error) throw new Error(evt.error);
      if (evt.done && evt.hint) return evt.hint;
    }
  }
}

function MicIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SpeakerSmallIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function StopSmallIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="3" />
    </svg>
  );
}

function StateIndicator({ state, interfaceLang }: { state: string; interfaceLang: Parameters<typeof t>[0] }) {
  const colors: Record<string, string> = {
    idle: "bg-sand border-line text-clay",
    listening: "bg-forest-soft border-forest/30 text-forest",
    processing: "bg-coral-soft border-coral/30 text-coral",
    speaking: "bg-forest-soft border-forest/30 text-forest",
  };
  const labels: Record<string, TranslationKey> = {
    idle: "ready", listening: "listening", processing: "processing", speaking: "aiSpeaking",
  };
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[state] ?? colors.idle}`}>
      {state === "listening" && <span className="w-1.5 h-1.5 rounded-full bg-forest animate-ping" />}
      {state === "processing" && <span className="w-1.5 h-1.5 rounded-full bg-coral animate-spin border border-coral/40 border-t-transparent" />}
      {state === "speaking" && <span className="w-1.5 h-1.5 rounded-full bg-forest animate-pulse" />}
      {state === "idle" && <span className="w-1.5 h-1.5 rounded-full bg-clay" />}
      {t(interfaceLang, labels[state] ?? "ready")}
    </div>
  );
}

export function ConversationView() {
  const {
    interfaceLanguage, feedbackLanguage,
    mode, scenario, level,
    messages, addMessage,
    micState, setMicState,
    turnCount, incrementTurn,
    setFeedback, setCurrentView,
    setLastAiMessage,
  } = useApp();

  const { settings: voiceSettings, updateSettings: updateVoiceSettings } = useVoiceSettings();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackFailed, setFeedbackFailed] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [msgTranslations, setMsgTranslations] = useState<Record<number, TranslationEntry>>({});
  const [hintData, setHintData] = useState<HintResponse | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [improveData, setImproveData] = useState<ImproveResponse | null>(null);
  const [improveLoading, setImproveLoading] = useState(false);
  const [improveOpen, setImproveOpen] = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState<number | null>(null);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState<VoiceAvailability>("available");
  const [endConfirm, setEndConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const learnerContextRef = useRef<string>("");
  const isProcessingRef = useRef(false);
  const speakGuardRef = useRef(0);
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const msgTranslationsRef = useRef<Record<number, TranslationEntry>>({});
  const speakingMsgIdxRef = useRef<number | null>(null);
  const pregenFeedbackRef = useRef<{ msgCount: number; result: FeedbackStreamResult | null } | null>(null);
  const micStateRef = useRef(micState);
  msgTranslationsRef.current = msgTranslations;
  speakingMsgIdxRef.current = speakingMsgIdx;
  micStateRef.current = micState;

  const conversationMutation = useSendConversationMessage();
  const translateMutation = useTranslateMessage();
  const improveMutation = useImproveMessage();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages, msgTranslations]);

  useEffect(() => {
    isMountedRef.current = true;
    warmUpTts();
    unlockTtsOnGesture(); // iOS: defer warm-up to first user gesture
    return () => {
      isMountedRef.current = false;
      stopSpeech();
      if (speakTimerRef.current !== null) {
        clearTimeout(speakTimerRef.current);
        speakTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const check = () => setVoiceAvailable(getVoiceAvailability(voiceSettings.accentPreference));
    check();
    window.speechSynthesis?.addEventListener("voiceschanged", check);
    // Fallback: some browsers load voices synchronously and never fire voiceschanged
    const t1 = setTimeout(check, 300);
    const t2 = setTimeout(check, 1000);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", check);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [voiceSettings.accentPreference]);

  // Auto-select and persist the best available English voice on first load
  useEffect(() => {
    const autoSelect = () => {
      if (voiceSettings.voiceURI) return; // Respect user's existing choice
      const uri = autoSelectVoiceURI(voiceSettings.accentPreference);
      if (uri) updateVoiceSettings({ voiceURI: uri });
    };
    autoSelect();
    window.speechSynthesis?.addEventListener("voiceschanged", autoSelect);
    const tid = setTimeout(autoSelect, 600);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", autoSelect);
      clearTimeout(tid);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Background feedback pre-generation ──────────────────────────────────────
  useEffect(() => {
    const count = messages.length;
    if (count < 4) return;
    const lastMsg = messages[count - 1];
    if (lastMsg?.role !== "assistant") return;
    pregenFeedbackRef.current = null;
    const profile = getLearnerProfile();
    fetchFeedbackStream({
      messages,
      mode,
      feedbackLanguage: feedbackLanguage || interfaceLanguage,
      interfaceLanguage,
      deviceId: profile.deviceId,
      scenario,
    }).then((fb) => {
      if (!isMountedRef.current) return;
      pregenFeedbackRef.current = { msgCount: count, result: fb };
    }).catch(() => { /* silent — pre-gen failure is non-fatal */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) return;
      stopSpeech();
      setSpeakingMsgIdx(null);
      speakGuardRef.current++;
      if (speakTimerRef.current !== null) {
        clearTimeout(speakTimerRef.current);
        speakTimerRef.current = null;
      }
      if (micStateRef.current === "speaking") setMicState("idle");
    };
    const handlePageHide = () => {
      stopSpeech();
      setSpeakingMsgIdx(null);
      speakGuardRef.current++;
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [setMicState]);

  const handleStopSpeech = useCallback(() => {
    stopSpeech();
    speakGuardRef.current++;
    if (speakTimerRef.current !== null) {
      clearTimeout(speakTimerRef.current);
      speakTimerRef.current = null;
    }
    setSpeakingMsgIdx(null);
    if (micState === "speaking") {
      setMicState("idle");
      isProcessingRef.current = false;
    }
  }, [micState, setMicState]);

  const handleSpeakMsg = useCallback((idx: number, text: string, rateOverride?: number) => {
    stopSpeech();
    speakGuardRef.current++;
    if (speakTimerRef.current !== null) {
      clearTimeout(speakTimerRef.current);
      speakTimerRef.current = null;
    }
    if (micState === "speaking") {
      setMicState("idle");
      isProcessingRef.current = false;
    }
    setSpeakingMsgIdx(idx);
    speak(text, {
      accent: voiceSettings.accentPreference,
      rate: rateOverride ?? voiceSettings.speakRate,
      voiceURI: voiceSettings.voiceURI || undefined,
      onEnd: () => {
        if (speakingMsgIdxRef.current === idx) setSpeakingMsgIdx(null);
      },
    });
  }, [micState, setMicState, voiceSettings]);

  const handleAiResponse = useCallback((aiText: string) => {
    addMessage({ role: "assistant", content: aiText });
    setLastAiMessage(aiText);

    if (!voiceSettings.autoSpeak) {
      setMicState("idle");
      isProcessingRef.current = false;
      return;
    }

    setMicState("speaking");
    const guardId = ++speakGuardRef.current;
    const onSpeechEnd = () => {
      if (!isMountedRef.current || guardId !== speakGuardRef.current) return;
      if (speakTimerRef.current !== null) {
        clearTimeout(speakTimerRef.current);
        speakTimerRef.current = null;
      }
      setMicState("idle");
      isProcessingRef.current = false;
    };
    speak(aiText, { accent: voiceSettings.accentPreference, rate: voiceSettings.speakRate, voiceURI: voiceSettings.voiceURI || undefined, onEnd: onSpeechEnd });
    speakTimerRef.current = setTimeout(onSpeechEnd, 120000);
  }, [addMessage, setLastAiMessage, setMicState, voiceSettings]);

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setErrorMsg(null);
    setHintOpen(false);
    setImproveOpen(false);

    addMessage({ role: "user", content: userText.trim() });
    incrementTurn();
    setMicState("processing");

    try {
      const allMessages: Message[] = [...messages, { role: "user", content: userText.trim() }];
      const result = await conversationMutation.mutateAsync({
        data: {
          messages: allMessages,
          mode,
          scenario,
          level,
          interfaceLanguage,
          feedbackLanguage: feedbackLanguage || interfaceLanguage,
          learnerContext: learnerContextRef.current || undefined,
        },
      });
      if (!isMountedRef.current) return;
      handleAiResponse(result.message);
    } catch {
      if (!isMountedRef.current) return;
      setMicState("idle");
      isProcessingRef.current = false;
      setErrorMsg(t(interfaceLanguage, "aiUnavailable"));
    }
  }, [messages, mode, scenario, level, interfaceLanguage, feedbackLanguage, addMessage, incrementTurn, setMicState, conversationMutation, handleAiResponse]);

  const handleSpeechResult = useCallback((transcript: string) => {
    if (!transcript.trim()) return;
    sendMessage(transcript);
  }, [sendMessage]);

  const { isListening, isTranscribing, isSupported, startListening, stopListening, interimTranscript, error: speechError } = useVoiceInput(handleSpeechResult);

  // Reflect the brief server transcription round-trip as the "processing" mic state.
  useEffect(() => {
    if (isTranscribing) setMicState("processing");
  }, [isTranscribing, setMicState]);

  useEffect(() => {
    if (!speechError) return;
    const msgs: Record<string, TranslationKey> = {
      mic_denied: "micDenied",
      no_speech: "noSpeech",
      browser_unsupported: "browserUnsupported",
      network_error: "networkError",
      aborted: "ready",
    };
    const msgKey = msgs[speechError] ?? "networkError";
    setErrorMsg(msgKey === "browserUnsupported"
      ? t(interfaceLanguage, "browserUnsupported")
      : msgKey === "micDenied"
        ? t(interfaceLanguage, "micDenied")
        : msgKey === "noSpeech"
          ? t(interfaceLanguage, "noSpeech")
          : t(interfaceLanguage, "networkError"));
    setMicState("idle");
    isProcessingRef.current = false;
  }, [speechError, interfaceLanguage, setMicState]);

  const handleMicPress = useCallback(() => {
    if (micState === "speaking") {
      handleStopSpeech();
      return;
    }
    if (micState === "processing") return;
    if (isListening) {
      stopListening();
      setMicState("idle");
      isProcessingRef.current = false;
      return;
    }
    if (micState === "idle") {
      setErrorMsg(null);
      setMicState("listening");
      if (!sessionStarted) setSessionStarted(true);
      startListening();
    }
  }, [micState, isListening, startListening, stopListening, setMicState, handleStopSpeech, sessionStarted]);

  const handleTextSend = useCallback(() => {
    const text = textInput.trim();
    if (!text) return;
    if (!sessionStarted) setSessionStarted(true);
    setTextInput("");
    sendMessage(text);
  }, [textInput, sessionStarted, sendMessage]);

  const handleTranslate = useCallback(async (idx: number, text: string) => {
    const prev = msgTranslationsRef.current[idx];
    if (prev?.visible) {
      setMsgTranslations((s) => ({ ...s, [idx]: { ...s[idx], visible: false } }));
      return;
    }
    if (prev?.text) {
      setMsgTranslations((s) => ({ ...s, [idx]: { ...s[idx], visible: true } }));
      return;
    }
    setMsgTranslations((s) => ({ ...s, [idx]: { text: "", loading: true, error: false, visible: true } }));
    try {
      const res = await translateMutation.mutateAsync({ data: { text, targetLanguage: feedbackLanguage || interfaceLanguage } });
      setMsgTranslations((s) => ({ ...s, [idx]: { text: res.translation, loading: false, error: false, visible: true } }));
    } catch {
      setMsgTranslations((s) => ({ ...s, [idx]: { text: "", loading: false, error: true, visible: true } }));
    }
  }, [feedbackLanguage, interfaceLanguage, translateMutation]);

  const handleHint = useCallback(async () => {
    if (hintOpen) {
      setHintOpen(false);
      return;
    }
    setHintLoading(true);
    setHintOpen(true);
    setImproveOpen(false);
    try {
      const hint = await fetchHintStream({
        messages,
        scenario,
        level,
        feedbackLanguage: feedbackLanguage || interfaceLanguage,
        interfaceLanguage,
        learnerContext: learnerContextRef.current || undefined,
      });
      setHintData(hint);
    } catch {
      setHintData(null);
      setHintOpen(false);
      setErrorMsg(t(interfaceLanguage, "hintUnavailable"));
    } finally {
      setHintLoading(false);
    }
  }, [hintOpen, messages, scenario, level, feedbackLanguage, interfaceLanguage]);

  const handleImprove = useCallback(async () => {
    const text = textInput.trim();
    if (!text) return;
    if (improveOpen) {
      setImproveOpen(false);
      return;
    }
    setImproveLoading(true);
    setImproveOpen(true);
    setHintOpen(false);
    try {
      const res = await improveMutation.mutateAsync({
        data: {
          text,
          scenario,
          feedbackLanguage: feedbackLanguage || interfaceLanguage,
        },
      });
      setImproveData(res);
    } catch {
      setImproveData(null);
      setImproveOpen(false);
      setErrorMsg(t(interfaceLanguage, "improveUnavailable"));
    } finally {
      setImproveLoading(false);
    }
  }, [textInput, improveOpen, scenario, feedbackLanguage, interfaceLanguage, improveMutation]);

  const handleEndSession = useCallback(async () => {
    if (messages.length < 2) {
      setCurrentView("setup");
      return;
    }
    if (!endConfirm) {
      setEndConfirm(true);
      return;
    }
    setEndConfirm(false);

    // Use pre-generated feedback if it matches the current conversation
    const cached = pregenFeedbackRef.current;
    if (cached && cached.msgCount === messages.length && cached.result) {
      const fb = cached.result;
      stopSpeech();
      speakGuardRef.current++;
      const profile = getLearnerProfile();
      learnerContextRef.current = buildMemoryNote(profile);
      setFeedback({
        estimatedLevel: fb.estimatedLevel,
        strengths: fb.strengths,
        improvements: fb.improvements,
        correctedExample: fb.correctedExample,
        fluencyComment: fb.fluencyComment,
        nextStep: fb.nextStep,
        strongestPhrase: fb.strongestPhrase,
        tip: fb.tip,
        isFallback: false,
      });
      updateAfterSession(fb.estimatedLevel, fb.improvements, scenario);
      setCurrentView("feedback");
      return;
    }

    setFeedbackLoading(true);
    setFeedbackFailed(false);
    stopSpeech();
    speakGuardRef.current++;
    try {
      const profile = getLearnerProfile();
      learnerContextRef.current = buildMemoryNote(profile);
      const fb = await fetchFeedbackStream({
        messages,
        mode,
        feedbackLanguage: feedbackLanguage || interfaceLanguage,
        interfaceLanguage,
        deviceId: profile.deviceId,
        scenario,
      });
      setFeedback({
        estimatedLevel: fb.estimatedLevel,
        strengths: fb.strengths,
        improvements: fb.improvements,
        correctedExample: fb.correctedExample,
        fluencyComment: fb.fluencyComment,
        nextStep: fb.nextStep,
        strongestPhrase: fb.strongestPhrase,
        tip: fb.tip,
        isFallback: false,
      });
      updateAfterSession(fb.estimatedLevel, fb.improvements, scenario);
      setCurrentView("feedback");
    } catch {
      setFeedback({
        estimatedLevel: "B1",
        strengths: [],
        improvements: [],
        correctedExample: "",
        fluencyComment: "",
        nextStep: "",
        strongestPhrase: "",
        tip: "",
        isFallback: true,
        fallbackReason: t(interfaceLanguage, "aiUnavailable"),
      });
      setFeedbackFailed(true);
      setCurrentView("feedback");
    } finally {
      setFeedbackLoading(false);
    }
  }, [messages, mode, scenario, feedbackLanguage, interfaceLanguage, endConfirm, setFeedback, setCurrentView]);

  const isBlocked = micState === "processing" || feedbackLoading;
  const turnPct = Math.min((turnCount / MAX_TURNS) * 100, 100);
  const turnsLeft = MAX_TURNS - turnCount;

  const scenarioEmoji = SCENARIO_EMOJIS[scenario];
  const scenarioLabel = t(interfaceLanguage, SCENARIO_LABEL_KEYS[scenario]);
  const levelLabel = LEVEL_CEFR[level] ?? level;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-ivory overflow-hidden">

      <header className="relative z-10 mx-auto w-full max-w-3xl flex-shrink-0 px-4 pt-safe pt-3 pb-2 border-b border-line">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg flex-shrink-0">{scenarioEmoji}</span>
            <div className="min-w-0">
              <p className="text-ink text-sm font-semibold leading-tight truncate">{scenarioLabel}</p>
              <p className="text-clay text-[10px] leading-tight">{levelLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <StateIndicator state={micState} interfaceLang={interfaceLanguage} />
            <button
              onClick={() => setShowVoicePanel(true)}
              className="relative w-11 h-11 flex items-center justify-center rounded-full text-clay hover:text-ink-soft hover:bg-line transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
              aria-label={t(interfaceLanguage, "settingsBtn")}
            >
              {voiceAvailable === "limited" && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-ivory" aria-hidden="true" />
              )}
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-sand overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-coral to-coral-dark" style={{ width: `${turnPct}%` }} transition={{ duration: 0.4 }} />
          </div>
          <span className="text-clay text-[10px] tabular-nums flex-shrink-0">{turnCount}/{MAX_TURNS}</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-3 space-y-3" role="log" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col items-center justify-center h-full min-h-[240px] text-center px-6">
            <div className="text-5xl mb-4">{scenarioEmoji}</div>
            <p className="text-ink text-base font-bold mb-1">{scenarioLabel}</p>
            <p className="text-clay text-[10px] uppercase tracking-widest font-semibold mb-6">{levelLabel}</p>
            <div className="flex flex-col items-center gap-3">
              {isSupported ? (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-forest-soft border border-forest/25 text-forest text-sm font-medium">
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  {t(interfaceLanguage, "tapToSpeak")}
                </div>
              ) : null}
              <p className="text-clay text-xs">{isSupported ? t(interfaceLanguage, "typeMessage") : t(interfaceLanguage, "browserUnsupported")}</p>
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            const translation = msgTranslations[idx];
            const isSpeakingThis = speakingMsgIdx === idx;

            return (
              <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] ${isUser ? "" : "flex flex-col gap-1"}`}>
                  <p className={`text-[10px] font-medium mb-1 ${isUser ? "text-right text-coral/70" : "text-left text-forest/70"}`}>
                    {isUser ? t(interfaceLanguage, "you") : t(interfaceLanguage, "ai")}
                  </p>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isUser ? "bg-forest border border-forest text-cream rounded-br-md" : "bg-sand border border-line text-ink rounded-bl-md"}`}>
                    {msg.content}
                  </div>
                  {!isUser && (
                    <div className="flex items-center gap-1.5 mt-1 px-1">
                      <button
                        onClick={() => isSpeakingThis ? handleStopSpeech() : handleSpeakMsg(idx, msg.content)}
                        className={`flex items-center gap-1 px-3 py-2.5 min-h-[44px] rounded-lg text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/50 ${isSpeakingThis ? "bg-forest-soft border border-forest/30 text-forest" : "bg-sand border border-line text-clay hover:text-ink-soft hover:bg-line"}`}
                      >
                        {isSpeakingThis ? <><StopSmallIcon />{t(interfaceLanguage, "stopBtn")}</> : <><SpeakerSmallIcon />{t(interfaceLanguage, "replayButton")}</>}
                      </button>
                      {!isSpeakingThis && (
                        <button
                          onClick={() => handleSpeakMsg(idx, msg.content, 0.7)}
                          title={t(interfaceLanguage, "replaySlowly")}
                          aria-label={t(interfaceLanguage, "replaySlowly")}
                          className="flex items-center justify-center w-10 min-h-[44px] rounded-lg text-base bg-sand border border-line text-clay hover:text-ink-soft hover:bg-line transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
                        >
                          🐢
                        </button>
                      )}
                      {feedbackLanguage !== "English" && (
                        <button
                          onClick={() => handleTranslate(idx, msg.content)}
                          className="flex items-center gap-1 px-3 py-2.5 min-h-[44px] rounded-lg text-[11px] font-medium bg-sand border border-line text-clay hover:text-ink-soft hover:bg-line transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
                        >
                          {translation?.loading ? t(interfaceLanguage, "translating") : translation?.visible ? t(interfaceLanguage, "hideTranslation") : t(interfaceLanguage, "translateButton")}
                        </button>
                      )}
                    </div>
                  )}
                  <AnimatePresence>
                    {translation?.visible && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="mt-1.5 px-3 py-2 rounded-xl bg-coral-soft border border-coral/20">
                          {translation.loading && <p className="text-coral/70 text-xs">{t(interfaceLanguage, "translating")}</p>}
                          {translation.error && <p className="text-red-600 text-xs">{t(interfaceLanguage, "translationError")}</p>}
                          {translation.text && <p className="text-coral-dark text-xs leading-relaxed">{translation.text}</p>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {micState === "processing" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-sand border border-line flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 0.15, 0.3].map((d) => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-clay animate-bounce" style={{ animationDelay: `${d}s` }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {isListening && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end">
            {/* Fixed min-height prevents layout shift when transcript text appears */}
            <div className="max-w-[82%] px-4 py-3 rounded-2xl rounded-br-md bg-coral-soft border border-coral/25 border-dashed text-ink-soft text-sm italic min-h-[48px] flex items-center">
              {interimTranscript
                ? `${interimTranscript}…`
                : (
                  <span className="flex gap-1.5 items-center" aria-label="Listening">
                    <span className="w-1.5 h-1.5 rounded-full bg-clay animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-clay animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-clay animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                )}
            </div>
          </motion.div>
        )}

        {errorMsg && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-sm px-4 py-2.5 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs text-center">
            {errorMsg}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {hintOpen && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }} className="flex-shrink-0 mx-4 mb-2 max-h-48 overflow-y-auto p-4 rounded-2xl bg-cream border border-coral/25 shadow-xl">
            {hintLoading ? (
              <div className="flex items-center gap-2 text-clay text-sm">
                <span className="w-3 h-3 border border-coral border-t-transparent rounded-full animate-spin flex-shrink-0" />
                {t(interfaceLanguage, "loading")}
              </div>
            ) : hintData ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-coral text-xs font-semibold uppercase tracking-widest">{t(interfaceLanguage, "helpMeAnswer")}</p>
                  <button onClick={() => setHintOpen(false)} className="w-11 h-11 flex items-center justify-center rounded-full text-clay hover:text-ink-soft hover:bg-line transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/50">✕</button>
                </div>
                {hintData.simpleReplies.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setTextInput(r);
                      setHintOpen(false);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left px-3 py-3 min-h-[44px] rounded-xl bg-coral-soft border border-coral/25 text-ink text-sm hover:bg-coral/15 transition-colors"
                  >
                    {r}
                  </button>
                ))}
                {hintData.naturalReply && (
                  <button
                    onClick={() => {
                      setTextInput(hintData.naturalReply);
                      setHintOpen(false);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left px-3 py-3 min-h-[44px] rounded-xl bg-coral-soft border border-coral/25 text-ink text-sm hover:bg-coral/15 transition-colors"
                  >
                    <span className="text-coral text-[10px] font-semibold block mb-0.5">{t(interfaceLanguage, "moreNatural")}</span>
                    {hintData.naturalReply}
                  </button>
                )}
                {hintData.explanation && <p className="text-clay text-xs leading-relaxed px-1">{hintData.explanation}</p>}
                {hintData.vocabularyHelp && <p className="text-forest/70 text-xs leading-relaxed px-1">📖 {hintData.vocabularyHelp}</p>}
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {improveOpen && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }} className="flex-shrink-0 mx-4 mb-2 max-h-48 overflow-y-auto p-4 rounded-2xl bg-cream border border-forest/25 shadow-xl">
            {improveLoading ? (
              <div className="flex items-center gap-2 text-clay text-sm">
                <span className="w-3 h-3 border border-forest border-t-transparent rounded-full animate-spin flex-shrink-0" />
                {t(interfaceLanguage, "loading")}
              </div>
            ) : improveData ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-forest text-xs font-semibold uppercase tracking-widest">{t(interfaceLanguage, "improveMyMessage")}</p>
                  <button onClick={() => setImproveOpen(false)} className="w-11 h-11 flex items-center justify-center rounded-full text-clay hover:text-ink-soft hover:bg-line transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50">✕</button>
                </div>
                {improveData.corrected && improveData.corrected !== textInput && (
                  <button
                    onClick={() => {
                      setTextInput(improveData.corrected);
                      setImproveOpen(false);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left px-3 py-3 min-h-[44px] rounded-xl bg-forest-soft border border-forest/25 text-ink text-sm hover:bg-forest/10 transition-colors"
                  >
                    <span className="text-forest text-[10px] font-semibold block mb-0.5">{t(interfaceLanguage, "correctedLabel")}</span>
                    {improveData.corrected}
                  </button>
                )}
                {improveData.natural && (
                  <button
                    onClick={() => {
                      setTextInput(improveData.natural);
                      setImproveOpen(false);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left px-3 py-3 min-h-[44px] rounded-xl bg-coral-soft border border-coral/25 text-ink text-sm hover:bg-coral/15 transition-colors"
                  >
                    <span className="text-coral text-[10px] font-semibold block mb-0.5">{t(interfaceLanguage, "moreNatural")}</span>
                    {improveData.natural}
                  </button>
                )}
                {improveData.explanation && <p className="text-clay text-xs leading-relaxed px-1">{improveData.explanation}</p>}
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto w-full max-w-3xl flex-shrink-0 px-4 pb-safe pb-4 pt-2 border-t border-line space-y-2">
        {micState === "speaking" && voiceSettings.autoSpeak && (
          <p className="text-center text-forest/60 text-[11px]">{t(interfaceLanguage, "tapToInterrupt")}</p>
        )}

        {!voiceSettings.autoSpeak && messages.some((m) => m.role === "assistant") && (
          <p className="text-center text-clay text-[10px]">{t(interfaceLanguage, "autoSpeakOffMsg")}</p>
        )}

        {voiceAvailable === "unavailable" && (
          <p className="text-center text-amber-600 text-[10px]">
            {t(interfaceLanguage, "voiceUnavailableMsg")}
          </p>
        )}

        {!isSupported && (
          <p className="text-center text-amber-600 text-[10px]">
            🎤 {t(interfaceLanguage, "browserUnsupported")}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleHint}
            disabled={isBlocked}
            className={`flex-1 py-3 min-h-[44px] rounded-xl text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/50 ${
              hintOpen
                ? "bg-coral-soft border-coral/40 text-coral-dark"
                : "bg-sand border-line text-ink-soft hover:bg-line hover:text-ink disabled:opacity-40"
            }`}
          >
            💡 {t(interfaceLanguage, "helpMeAnswer")}
          </button>
          <button
            onClick={handleImprove}
            disabled={isBlocked || !textInput.trim()}
            className={`flex-1 py-3 min-h-[44px] rounded-xl text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 ${
              improveOpen
                ? "bg-forest-soft border-forest/40 text-forest"
                : "bg-sand border-line text-ink-soft hover:bg-line hover:text-ink disabled:opacity-40"
            }`}
          >
            ✏️ {t(interfaceLanguage, "improveMyMessage")}
          </button>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleTextSend();
                }
              }}
              placeholder={t(interfaceLanguage, "typeMessage")}
              aria-label={t(interfaceLanguage, "typeMessage")}
              disabled={isBlocked}
              className="w-full px-4 py-3 rounded-2xl bg-cream border border-line text-ink placeholder-clay text-sm focus:outline-none focus:border-coral/50 focus:bg-cream transition-all disabled:opacity-50"
            />
            {textInput.trim() && (
              <button
                onClick={handleTextSend}
                disabled={isBlocked}
                aria-label="Send message"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl bg-coral flex items-center justify-center text-cream hover:bg-coral-dark transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            )}
          </div>

          {isSupported && (
            <motion.button
              onClick={handleMicPress}
              disabled={micState === "processing" || feedbackLoading}
              whileTap={{ scale: 0.92 }}
              className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl transition-all duration-200 disabled:opacity-40 ${
                micState === "listening"
                  ? "bg-forest text-cream shadow-lg shadow-forest/30"
                  : micState === "speaking"
                  ? "bg-forest-soft text-forest border border-forest/50"
                  : micState === "processing"
                  ? "bg-coral-soft text-coral border border-coral/30"
                  : "bg-cream text-ink-soft border border-line hover:bg-sand"
              }`}
              aria-label={micState === "listening" ? t(interfaceLanguage, "stopBtn") : t(interfaceLanguage, "speakBtn")}
            >
              {micState === "listening" ? (
                <div className="relative">
                  <MicIcon size={20} />
                  <span className="absolute -inset-2 rounded-full border-2 border-forest/40 animate-ping" />
                </div>
              ) : micState === "speaking" ? (
                <StopSmallIcon />
              ) : (
                <MicIcon size={20} />
              )}
            </motion.button>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          {feedbackFailed && (
            <p className="text-red-600 text-xs flex-1">{t(interfaceLanguage, "aiUnavailable")}</p>
          )}

          {turnsLeft <= 3 && turnsLeft > 0 && (
            <p className="text-amber-600 text-xs flex-1">{t(interfaceLanguage, "turnOf").replace("{current}", String(turnCount)).replace("{total}", String(MAX_TURNS))}</p>
          )}

          <button
            onClick={handleEndSession}
            disabled={feedbackLoading}
            className={`ml-auto flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
              endConfirm
                ? "bg-red-50 border border-red-300 text-red-600"
                : feedbackLoading
                ? "bg-sand border border-line text-clay"
                : "bg-sand border border-line text-ink-soft hover:bg-line hover:text-ink"
            }`}
          >
            {feedbackLoading ? (
              <>
                <span className="w-3 h-3 border border-clay border-t-ink rounded-full animate-spin" />
                {t(interfaceLanguage, "loading")}
              </>
            ) : endConfirm ? (
              <>✓ {t(interfaceLanguage, "endSession") }?</>
            ) : (
              t(interfaceLanguage, "endSession")
            )}
          </button>

          {endConfirm && (
            <button
              onClick={() => setEndConfirm(false)}
              className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-medium text-clay hover:text-ink-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line"
            >
              {t(interfaceLanguage, "back")}
            </button>
          )}
        </div>
      </div>

      {showVoicePanel && (
        <VoiceSettingsPanel
          settings={voiceSettings}
          onUpdate={updateVoiceSettings}
          onClose={() => setShowVoicePanel(false)}
        />
      )}
    </div>
  );
}
