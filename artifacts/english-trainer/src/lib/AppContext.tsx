import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { Language } from "@/i18n/translations";
import { getLearnerProfile, updateLearnerLanguages } from "@/lib/learnerMemory";

export type Mode = "practice" | "challenge" | "exam";
export type Scenario =
  | "job_interview" | "small_talk" | "business_meeting" | "travel" | "daily_life"
  | "restaurant" | "shopping" | "medical" | "academic" | "phone_call"
  | "airport" | "hotel" | "banking" | "apartment" | "dating"
  | "sports" | "news_debate" | "customer_service" | "tech_support" | "real_estate"
  | "legal" | "emergency" | "cooking" | "entertainment" | "networking"
  | "luxury_boutique" | "trade_fair" | "executive_assistant" | "medical_secretary" | "journalist_interview"
  | "salary_negotiation" | "performance_review" | "presentation" | "client_pitch" | "border_control"
  | "pharmacy" | "admin_office" | "formal_complaint";
export type Level = "auto" | "beginner" | "intermediate" | "advanced";
export type MicState = "idle" | "listening" | "processing" | "speaking";
export type View = "home" | "language" | "setup" | "conversation" | "feedback" | "privacy";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface FeedbackData {
  estimatedLevel: string;
  strengths: string[];
  improvements: string[];
  correctedExample: string;
  fluencyComment: string;
  nextStep: string;
  strongestPhrase: string;
  tip: string;
  isFallback: boolean;
  fallbackReason?: string;
}

interface AppState {
  currentView: View;
  interfaceLanguage: Language;
  feedbackLanguage: Language;
  mode: Mode;
  scenario: Scenario;
  level: Level;
  messages: Message[];
  micState: MicState;
  feedback: FeedbackData | null;
  turnCount: number;
  lastAiMessage: string;
}

interface AppContextValue extends AppState {
  setCurrentView: (view: View) => void;
  setInterfaceLanguage: (lang: Language) => void;
  setFeedbackLanguage: (lang: Language) => void;
  setMode: (mode: Mode) => void;
  setScenario: (scenario: Scenario) => void;
  setLevel: (level: Level) => void;
  addMessage: (message: Message) => void;
  setMicState: (state: MicState) => void;
  setFeedback: (feedback: FeedbackData) => void;
  incrementTurn: () => void;
  resetSession: () => void;
  setLastAiMessage: (msg: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const BASE_DEFAULT: Omit<AppState, "interfaceLanguage" | "feedbackLanguage"> = {
  currentView: "home",
  mode: "practice",
  scenario: "small_talk",
  level: "auto",
  messages: [],
  micState: "idle",
  feedback: null,
  turnCount: 0,
  lastAiMessage: "",
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    const profile = getLearnerProfile();
    return {
      ...BASE_DEFAULT,
      interfaceLanguage: (profile.preferredInterfaceLanguage as Language) || "English",
      feedbackLanguage: (profile.preferredFeedbackLanguage as Language) || "English",
    };
  });

  useEffect(() => {
    updateLearnerLanguages(state.feedbackLanguage, state.interfaceLanguage);
  }, [state.feedbackLanguage, state.interfaceLanguage]);

  const setCurrentView = useCallback((view: View) => {
    setState((s) => ({ ...s, currentView: view }));
  }, []);

  const setInterfaceLanguage = useCallback((lang: Language) => {
    setState((s) => ({ ...s, interfaceLanguage: lang, feedbackLanguage: lang }));
  }, []);

  const setFeedbackLanguage = useCallback((lang: Language) => {
    setState((s) => ({ ...s, feedbackLanguage: lang }));
  }, []);

  const setMode = useCallback((mode: Mode) => {
    setState((s) => ({ ...s, mode }));
  }, []);

  const setScenario = useCallback((scenario: Scenario) => {
    setState((s) => ({ ...s, scenario }));
  }, []);

  const setLevel = useCallback((level: Level) => {
    setState((s) => ({ ...s, level }));
  }, []);

  const addMessage = useCallback((message: Message) => {
    setState((s) => ({ ...s, messages: [...s.messages, message] }));
  }, []);

  const setMicState = useCallback((micState: MicState) => {
    setState((s) => ({ ...s, micState }));
  }, []);

  const setFeedback = useCallback((feedback: FeedbackData) => {
    setState((s) => ({ ...s, feedback }));
  }, []);

  const incrementTurn = useCallback(() => {
    setState((s) => ({ ...s, turnCount: s.turnCount + 1 }));
  }, []);

  const setLastAiMessage = useCallback((msg: string) => {
    setState((s) => ({ ...s, lastAiMessage: msg }));
  }, []);

  const resetSession = useCallback(() => {
    setState((s) => ({
      ...BASE_DEFAULT,
      interfaceLanguage: s.interfaceLanguage,
      feedbackLanguage: s.feedbackLanguage,
    }));
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        setCurrentView,
        setInterfaceLanguage,
        setFeedbackLanguage,
        setMode,
        setScenario,
        setLevel,
        addMessage,
        setMicState,
        setFeedback,
        incrementTurn,
        resetSession,
        setLastAiMessage,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
