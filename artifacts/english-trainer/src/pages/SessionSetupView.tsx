import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, type Mode, type Scenario, type Level } from "@/lib/AppContext";
import { LANGUAGES, LANGUAGE_NATIVE_NAMES, type Language, t } from "@/i18n/translations";
import { getLearnerProfile } from "@/lib/learnerMemory";

// ─── Featured 8 scenarios ─────────────────────────────────────────────────────
const FEATURED: { value: Scenario; emoji: string; labelKey: string; descKey: string }[] = [
  { value: "small_talk",           emoji: "☕", labelKey: "smallTalk",           descKey: "smallTalkDesc" },
  { value: "job_interview",        emoji: "💼", labelKey: "jobInterview",        descKey: "jobInterviewDesc" },
  { value: "travel",               emoji: "✈️", labelKey: "travel",              descKey: "travelDesc" },
  { value: "luxury_boutique",      emoji: "💎", labelKey: "luxuryBoutique",      descKey: "luxuryBoutiqueDesc" },
  { value: "journalist_interview", emoji: "🎙️", labelKey: "journalistInterview", descKey: "journalistInterviewDesc" },
  { value: "networking",           emoji: "🤝", labelKey: "networking",          descKey: "networkingDesc" },
  { value: "executive_assistant",  emoji: "🗂️", labelKey: "executiveAssistant",  descKey: "executiveAssistantDesc" },
  { value: "medical_secretary",    emoji: "🩺", labelKey: "medicalSecretary",    descKey: "medicalSecretaryDesc" },
];

// ─── All remaining scenarios (30 total minus featured 8) ─────────────────────
const MORE_SCENARIOS: { value: Scenario; emoji: string; labelKey: string }[] = [
  { value: "business_meeting",  emoji: "📊", labelKey: "businessMeeting" },
  { value: "phone_call",        emoji: "📞", labelKey: "phoneCall" },
  { value: "trade_fair",        emoji: "🏛️", labelKey: "tradeFair" },
  { value: "legal",             emoji: "⚖️", labelKey: "legal" },
  { value: "banking",           emoji: "🏦", labelKey: "banking" },
  { value: "academic",          emoji: "🎓", labelKey: "academic" },
  { value: "customer_service",  emoji: "🎯", labelKey: "customerService" },
  { value: "tech_support",      emoji: "💻", labelKey: "techSupport" },
  { value: "news_debate",       emoji: "📰", labelKey: "newsDebate" },
  { value: "sports",            emoji: "🏋️", labelKey: "sports" },
  { value: "entertainment",     emoji: "🎬", labelKey: "entertainment" },
  { value: "dating",            emoji: "💬", labelKey: "dating" },
  { value: "airport",           emoji: "🛫", labelKey: "airport" },
  { value: "hotel",             emoji: "🏨", labelKey: "hotel" },
  { value: "real_estate",       emoji: "🏡", labelKey: "realEstate" },
  { value: "apartment",         emoji: "🏠", labelKey: "apartment" },
  { value: "restaurant",        emoji: "🍽️", labelKey: "restaurant" },
  { value: "shopping",          emoji: "🛍️", labelKey: "shopping" },
  { value: "medical",           emoji: "🏥", labelKey: "medical" },
  { value: "daily_life",        emoji: "🏙️", labelKey: "dailyLife" },
  { value: "emergency",         emoji: "🚨", labelKey: "emergency" },
  { value: "cooking",           emoji: "👨‍🍳", labelKey: "cooking" },
];

// ─── Coaches ──────────────────────────────────────────────────────────────────
const COACHES: { value: Mode; emoji: string; labelKey: string; descKey: string; activeClass: string }[] = [
  { value: "practice",  emoji: "🌱", labelKey: "friendlyLabel",  descKey: "practiceDesc",  activeClass: "bg-emerald-500/18 border-emerald-500/45 text-emerald-100" },
  { value: "challenge", emoji: "🔥", labelKey: "demandingLabel", descKey: "challengeDesc", activeClass: "bg-orange-500/18 border-orange-500/45 text-orange-100" },
  { value: "exam",      emoji: "🎓", labelKey: "examinerLabel",  descKey: "examDesc",      activeClass: "bg-violet-500/18 border-violet-500/45 text-violet-100" },
];

// ─── Levels ───────────────────────────────────────────────────────────────────
const LEVELS: { value: Level; icon: string; labelKey: string; subKey: string }[] = [
  { value: "auto",         icon: "⚡", labelKey: "auto",         subKey: "autoAdjusts" },
  { value: "beginner",     icon: "A2", labelKey: "beginner",     subKey: "beginnerSub" },
  { value: "intermediate", icon: "B1", labelKey: "intermediate", subKey: "dailyLife" },
  { value: "advanced",     icon: "C1", labelKey: "advanced",     subKey: "advancedSub" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function SessionSetupView() {
  const {
    interfaceLanguage, feedbackLanguage,
    setInterfaceLanguage, setFeedbackLanguage,
    mode, setMode,
    scenario, setScenario,
    level, setLevel,
    setCurrentView,
    messages, resetSession,
  } = useApp();

  const [moreOpen, setMoreOpen] = useState(false);

  const isFeatured = FEATURED.some((s) => s.value === scenario);

  const handleBegin = () => {
    if (messages.length > 0) resetSession();
    setCurrentView("conversation");
  };

  const hasHistory = getLearnerProfile().totalSessions > 0;

  const tr = (key: string) => t(interfaceLanguage, key as Parameters<typeof t>[1]);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-950 via-[#0e0e2c] to-slate-900 flex flex-col overflow-x-hidden">

      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-safe pt-12 pb-5 flex-shrink-0">
        <button
          onClick={() => setCurrentView("home")}
          aria-label={tr("back")}
          className="w-11 h-11 rounded-full bg-white/6 border border-white/10 flex items-center justify-center text-white/55 hover:text-white/90 hover:bg-white/10 transition-all flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-white font-semibold text-xl leading-tight">{tr("newSessionTitle")}</h1>
          <p className="text-white/30 text-xs mt-0.5">{tr("sessionSetupSub")}</p>
        </div>
        {/* Free badge */}
        <div className="ml-auto flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/12 border border-teal-500/25 text-teal-400 text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            {tr("freeLaunchBadge")}
          </span>
        </div>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto pb-36 min-w-0">
        {!hasHistory && (
          <section className="px-5 mb-6">
            <div className="rounded-2xl border border-teal-500/20 bg-teal-500/10 p-4 text-white/80">
              <p className="text-sm font-semibold text-teal-200 mb-1">{tr("freeLaunchBadge")}</p>
              <p className="text-xs leading-relaxed text-white/55">{tr("freeLaunchNote")}</p>
              <button type="button" onClick={() => setCurrentView("privacy")} className="mt-2 text-left text-[11px] text-white/45 leading-relaxed underline underline-offset-2 hover:text-white/60 transition-colors min-h-[44px] flex items-center">
                {tr("privacyNote")}
              </button>
            </div>
          </section>
        )}


        {/* ── Language ──────────────────────────────────────────────────── */}
        <section className="px-5 mb-6">
          <SectionLabel>{tr("yourLanguage")}</SectionLabel>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1" role="group" aria-label={tr("yourLanguage")}>
            {LANGUAGES.map((lang) => (
              <LangPill
                key={lang}
                lang={lang as Language}
                active={interfaceLanguage === lang}
                color="indigo"
                onClick={() => setInterfaceLanguage(lang as Language)}
              />
            ))}
          </div>
          <p className="text-[11px] text-white/35 mt-2 mb-2">{tr("feedbackTranslationLang")}</p>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1" role="group" aria-label={tr("feedbackTranslationLang")}>
            {LANGUAGES.map((lang) => (
              <LangPill
                key={lang}
                lang={lang as Language}
                active={feedbackLanguage === lang}
                color="teal"
                onClick={() => setFeedbackLanguage(lang as Language)}
              />
            ))}
          </div>
        </section>

        {/* ── Coach ─────────────────────────────────────────────────────── */}
        <section className="px-5 mb-6">
          <SectionLabel>{tr("coachPersona")}</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {COACHES.map(({ value, emoji, labelKey, descKey, activeClass }) => {
              const isActive = mode === value;
              return (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={`flex flex-col items-center text-center px-2 py-3 rounded-2xl border transition-all duration-200 min-h-[72px] ${
                    isActive ? activeClass : "bg-white/5 border-white/8 text-white/55 hover:bg-white/8"
                  }`}
                >
                  <span className="text-2xl leading-none mb-1.5">{emoji}</span>
                  <p className="text-[12px] font-semibold leading-tight">{tr(labelKey)}</p>
                  <p className="text-[11px] opacity-55 leading-tight mt-0.5">{tr(descKey)}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Featured scenarios ─────────────────────────────────────────── */}
        <section className="px-5 mb-3">
          <SectionLabel>{tr("selectScenario")}</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            {FEATURED.map(({ value, emoji, labelKey, descKey }) => {
              const isActive = scenario === value;
              const label = tr(labelKey);
              const desc = tr(descKey);
              return (
                <motion.button
                  key={value}
                  onClick={() => setScenario(value)}
                  whileTap={{ scale: 0.97 }}
                  className={`flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 min-h-[88px] ${
                    isActive
                      ? "bg-indigo-500/18 border-indigo-400/45 shadow-[0_0_18px_rgba(99,102,241,0.18)]"
                      : "bg-white/5 border-white/8 hover:bg-white/8 hover:border-white/15"
                  }`}
                >
                  <span className="text-2xl leading-none mb-2">{emoji}</span>
                  <p className={`text-[13px] font-semibold leading-tight mb-0.5 ${isActive ? "text-indigo-100" : "text-white/80"}`}>{label}</p>
                  <p className={`text-[10px] leading-snug ${isActive ? "text-indigo-200/55" : "text-white/35"}`}>{desc}</p>
                  {isActive && (
                    <div className="mt-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      <span className="text-[11px] text-indigo-300 font-bold uppercase tracking-wide">{tr("selectedLabel")}</span>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* ── More scenarios ────────────────────────────────────────────── */}
        <section className="px-5 mb-6">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="w-full flex items-center justify-between py-3 text-white/40 hover:text-white/65 transition-colors"
          >
            <span className="text-[11px] font-semibold tracking-wider uppercase">
              {moreOpen ? tr("hideTranslation") : tr("allScenariosBtn")}
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${moreOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <AnimatePresence>
            {moreOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-2 pt-1 pb-2">
                  {MORE_SCENARIOS.map(({ value, emoji, labelKey }) => {
                    const isActive = scenario === value;
                    const label = tr(labelKey);
                    return (
                      <button
                        key={value}
                        onClick={() => { setScenario(value); setMoreOpen(false); }}
                        className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-left transition-all min-h-[48px] ${
                          isActive
                            ? "bg-indigo-500/18 border-indigo-400/40 text-indigo-100"
                            : "bg-white/4 border-white/8 text-white/55 hover:bg-white/8 hover:text-white/80"
                        }`}
                      >
                        <span className="text-lg leading-none flex-shrink-0">{emoji}</span>
                        <span className="text-[12px] font-medium leading-tight">{label}</span>
                        {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                {/* Currently selected from "more" */}
                {!isFeatured && (
                  <p className="text-[11px] text-indigo-300/60 text-center mt-1">
                    {tr("selectedLabel")}: {tr(MORE_SCENARIOS.find((s) => s.value === scenario)?.labelKey ?? "") || scenario}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Show selected scenario from "more" even when collapsed */}
          {!moreOpen && !isFeatured && (
            <p className="text-[11px] text-indigo-300/70 -mt-1 mb-1">
              ✓ {tr("selectedLabel")}: {tr(MORE_SCENARIOS.find((s) => s.value === scenario)?.labelKey ?? "") || scenario}
            </p>
          )}
        </section>

        {/* ── Level ─────────────────────────────────────────────────────── */}
        <section className="px-5 mb-4">
          <SectionLabel>{tr("proficiencyLevel")}</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            {LEVELS.map(({ value, icon, labelKey, subKey }) => {
              const isActive = level === value;
              return (
                <button
                  key={value}
                  onClick={() => setLevel(value)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all duration-200 min-h-[60px] ${
                    isActive
                      ? "bg-indigo-500/18 border-indigo-500/45"
                      : "bg-white/5 border-white/8 hover:bg-white/8"
                  }`}
                >
                  <span className={`text-xs font-bold font-mono w-6 text-center flex-shrink-0 ${isActive ? "text-indigo-400" : "text-white/30"}`}>
                    {icon}
                  </span>
                  <div>
                    <p className={`text-[13px] font-semibold leading-tight ${isActive ? "text-indigo-50" : "text-white/70"}`}>{tr(labelKey)}</p>
                    <p className="text-[11px] text-white/30 leading-tight mt-0.5">{tr(subKey)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-10 px-5 pb-safe pb-6 pt-8 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pointer-events-none">
        <motion.button
          onClick={handleBegin}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="w-full min-h-[56px] py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold text-base shadow-[0_0_32px_rgba(99,102,241,0.35)] pointer-events-auto hover:opacity-95 transition-all flex items-center justify-center gap-2.5"
        >
          <svg className="w-5 h-5 text-indigo-200 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          {tr("startSpeaking")}
        </motion.button>
        <p className="text-center text-white/20 text-[11px] mt-2">{tr("settingsNote")}</p>
      </div>

    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">
      {children}
    </h2>
  );
}

function LangPill({ lang, active, color, onClick }: {
  lang: Language; active: boolean; color: "indigo" | "teal"; onClick: () => void;
}) {
  const activeClass = color === "indigo"
    ? "bg-indigo-500/22 border-indigo-500/45 text-indigo-100"
    : "bg-teal-500/22 border-teal-500/45 text-teal-100";
  return (
    <button
      onClick={onClick}
      className={`flex-none px-3 py-3 rounded-full border text-xs font-medium transition-all whitespace-nowrap min-h-[44px] ${
        active ? activeClass : "bg-white/5 border-white/8 text-white/40 hover:text-white/70 hover:border-white/15"
      }`}
    >
      {LANGUAGE_NATIVE_NAMES[lang]}
    </button>
  );
}
